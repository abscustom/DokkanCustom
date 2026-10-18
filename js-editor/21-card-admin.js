/* ============================================================
   CUSTOM CARD ADMIN: BIDIRECTIONAL FORM LINKS + SAFE DELETION
   ============================================================ */
(function () {
    const OWNER = 'abscustom';
    const REPO = 'abscustom.github.io';
    const BRANCH = 'main';
    const SITE_ROOT = 'https://abscustom.github.io/';
    const API_ROOT = `https://api.github.com/repos/${OWNER}/${REPO}`;
    const CUSTOM_CARDS_DIR = 'Custom Cards';
    // Manager reuses GitHub authorization; its tab session is separate from Editor credentials.
    const MANAGER_SESSION_KEY = 'card_manager_token';
    const isInlineManager = () => Boolean(document.querySelector('[data-card-admin-inline]'));
    const IGNORED_ROOT_FOLDERS = new Set([
        '.github', '.vscode', 'assets', 'css', 'json', 'js', 'js-calc',
        'js-card-details', 'js-editor', 'js-graphics', 'tools', 'images',
        'DokkanCustom', 'CardEditor', 'Custom Cards', 'js2', 'js3'
    ]);

    const { parseCard, updateLinkedHtml, updateLinkedJson, htmlHasAdminLink, getLinkedCards } = globalThis.createManagerCardTransforms({ DOMParser });
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const encodeRepoPath = path => String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');

    const state = {
        token: '',
        serverSession: null,
        cards: [],
        busy: false,
        linkMode: 'single',
        activeTool: 'link',
        focusReturnElement: null
    };

    const CARD_ADMIN_FOCUSABLE_SELECTOR = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

    function isCardAdminElementVisible(element) {
        if (!(element instanceof HTMLElement) || !element.isConnected || element.hasAttribute('disabled')) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
            && rect.width > 0 && rect.height > 0
            && rect.bottom > 0 && rect.top < window.innerHeight
            && rect.right > 0 && rect.left < window.innerWidth;
    }

    function focusCardAdminElement(element) {
        if (!element) return;
        try { element.focus({ preventScroll: true }); }
        catch { element.focus(); }
    }

    function getCardAdminFocusableElements(modal) {
        return Array.from(modal.querySelectorAll(CARD_ADMIN_FOCUSABLE_SELECTOR))
            .filter(isCardAdminElementVisible);
    }

    function restoreCardAdminDialogFocus() {
        const previous = state.focusReturnElement;
        state.focusReturnElement = null;
        const target = [
            previous,
            document.querySelector('.abs-mobile-trigger'),
            document.getElementById('sba-side-settings-button'),
            document.querySelector('#abs-main-sidebar .hud-nav-link'),
            document.querySelector('.abs-mobile-brand')
        ].find(isCardAdminElementVisible);
        focusCardAdminElement(target);
    }

    function handleCardAdminDialogKeydown(event) {
        const modal = document.getElementById('card-admin-modal');
        if (!modal || modal.style.display === 'none' || modal.getAttribute('aria-hidden') === 'true') return;

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (!state.busy) window.closeCardAdminModal();
            return;
        }

        if (event.key !== 'Tab') return;
        const focusable = getCardAdminFocusableElements(modal);
        if (!focusable.length) {
            event.preventDefault();
            focusCardAdminElement(modal);
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
            event.preventDefault();
            focusCardAdminElement(last);
        } else if (!event.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
            event.preventDefault();
            focusCardAdminElement(first);
        }
    }

    document.addEventListener('keydown', handleCardAdminDialogKeydown, true);

    function setStatus(message, type = '') {
        const el = document.getElementById('card-admin-status');
        if (!el) return;
        el.textContent = message;
        if (isInlineManager()) el.hidden = !message;
        el.classList.toggle('is-error', type === 'error');
        el.classList.toggle('is-success', type === 'success');
    }

    function getToken() {
        return document.getElementById('card-admin-token')?.value.trim() || state.token || '';
    }

    function setManagerAccess(account) {
        if (!isInlineManager()) return;
        document.getElementById('card-admin-auth').hidden = Boolean(account);
        document.getElementById('card-admin-session').hidden = !account;
        document.getElementById('card-admin-tools').style.display = account ? 'block' : 'none';
        document.getElementById('card-admin-account').textContent = account || '';
        if (account) {
            document.getElementById('card-admin-link-section').style.display = '';
            document.getElementById('card-admin-delete-section').style.display = '';
            const tool = new URLSearchParams(location.search).get('tool');
            if (tool === 'link' || tool === 'delete') {
                const section = document.getElementById(`card-admin-${tool}-section`);
                section.tabIndex = -1;
                section.focus();
                section.scrollIntoView({ block: 'start' });
            }
        }
    }

    function clearManagerSession() {
        state.token = '';
        state.serverSession = null;
        state.cards = [];
        sessionStorage.removeItem(MANAGER_SESSION_KEY);
        const input = document.getElementById('card-admin-token');
        if (input) input.value = '';
        setManagerAccess(null);
        document.dispatchEvent(new Event('card-admin-cards-change'));
    }

    window.logoutCardAdmin = function () {
        if (state.busy) return;
        if (window.ManagerAuth) return window.ManagerAuth.logout();
        clearManagerSession();
        populateCardSelectors();
        setStatus('Signed out.');
        document.getElementById('card-admin-token').focus();
    };

    window.initCardAdminManager = function () {
        if (!isInlineManager() || state.managerInitialized) return;
        state.managerInitialized = true;
        setManagerAccess(null);
        if (window.ManagerAuth) {
            // Manager credentials never enter this runtime. Editor keeps its separate workflow.
            sessionStorage.removeItem(MANAGER_SESSION_KEY);
            return window.ManagerAuth.init();
        }
        const input = document.getElementById('card-admin-token');
        const session = sessionStorage.getItem(MANAGER_SESSION_KEY);
        input.value = '';
        input.removeAttribute('aria-invalid');
        const form = document.getElementById('card-admin-auth-form');
        if (form) {
            form.addEventListener('submit', event => {
                event.preventDefault();
                window.loadCardAdminCards();
            });
        } else {
            input.addEventListener('keydown', event => {
                if (event.key === 'Enter' && !event.isComposing) {
                    event.preventDefault();
                    window.loadCardAdminCards();
                }
            });
        }
        if (session) window.loadCardAdminCards(session);
        else { setStatus(''); input.focus(); }
    };

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
            if (response.status === 401 && isInlineManager()) clearManagerSession();
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
        const thumbnail = `<img src="${escapeHtml(card.thumb)}" alt="${escapeHtml(card.name)}">`;
        const portrait = containerId === 'card-admin-delete-preview'
            ? `<span class="card-admin-preview-portrait">${thumbnail}</span>`
            : thumbnail;
        container.innerHTML = `
            <div class="card-admin-preview-item">
                ${portrait}
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
                <span class="card-admin-delete-choice-portrait"><img src="${escapeHtml(card.thumb)}" alt="" onerror="this.src='https://abscustom.github.io/assets/images/default.png'"></span>
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
        document.dispatchEvent(new Event('card-admin-cards-change'));
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
        if (isInlineManager()) {
            if (state.token) document.getElementById(tool === 'delete' ? 'card-admin-delete-section' : 'card-admin-link-section')?.scrollIntoView({ block: 'start' });
            else document.getElementById('card-admin-token')?.focus();
            return;
        }
        const modal = document.getElementById('card-admin-modal');
        const tokenInput = document.getElementById('card-admin-token');
        const tools = document.getElementById('card-admin-tools');
        const linkSection = document.getElementById('card-admin-link-section');
        const deleteSection = document.getElementById('card-admin-delete-section');
        const title = document.getElementById('card-admin-title');
        state.activeTool = tool === 'delete' ? 'delete' : 'link';

        const wasOpen = Boolean(modal && modal.style.display !== 'none');
        if (modal && !wasOpen) state.focusReturnElement = document.activeElement;
        if (linkSection) linkSection.style.display = state.activeTool === 'link' ? '' : 'none';
        if (deleteSection) deleteSection.style.display = state.activeTool === 'delete' ? '' : 'none';
        if (title) title.textContent = state.activeTool === 'delete' ? 'Delete Custom Card' : 'Link Custom Cards';
        if (tokenInput) tokenInput.value = localStorage.getItem('gh_token') || '';
        if (tools) tools.style.display = 'none';
        if (modal) {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-hidden', 'false');
            modal.setAttribute('tabindex', '-1');
            if (title?.id) modal.setAttribute('aria-labelledby', title.id);
            else modal.setAttribute('aria-label', 'Card administration');
            modal.querySelector('.clean-modal-close')?.setAttribute('aria-label', 'Close card administration dialog');
            modal.classList.remove('is-closing');
            modal.style.display = 'flex';
            window.requestAnimationFrame(() => {
                if (modal.style.display === 'none') return;
                focusCardAdminElement(getCardAdminFocusableElements(modal)[0] || modal);
            });
        }
    };

    window.closeCardAdminModal = function () {
        const modal = document.getElementById('card-admin-modal');
        if (modal && !state.busy) {
            const afterClose = () => {
                modal.setAttribute('aria-hidden', 'true');
                restoreCardAdminDialogFocus();
            };
            if (window.fadeOutModal) window.fadeOutModal(modal, afterClose);
            else {
                modal.style.display = 'none';
                afterClose();
            }
        }
    };

    window.loadCardAdminCards = async function (managerSessionToken = '') {
        if (state.busy) return;
        const manager = isInlineManager();
        const input = document.getElementById('card-admin-token');
        const button = document.querySelector('.card-admin-load-btn');
        const token = manager && typeof managerSessionToken === 'string' && managerSessionToken ? managerSessionToken : getToken();
        if (token.length < 16) {
            if (manager) {
                if (managerSessionToken) clearManagerSession();
                input.value = '';
                input.setAttribute('aria-invalid', 'true');
                input.focus();
            }
            setStatus(manager ? 'Enter your credential to sign in.' : 'Enter a valid GitHub access token first.', 'error');
            return;
        }

        state.busy = true;
        if (manager) {
            input.value = '';
            input.removeAttribute('aria-invalid');
            input.disabled = true;
            if (button) { button.disabled = true; button.textContent = 'Signing in…'; }
            document.getElementById('card-admin-auth').setAttribute('aria-busy', 'true');
        }
        setStatus(manager ? 'Signing in…' : 'Signing in with GitHub and loading uploaded cards...');
        try {
            const account = await githubRequest('https://api.github.com/user', token);
            const rootItems = await githubRequest(`${API_ROOT}/contents/?ref=${BRANCH}`, token);
            const folders = rootItems.filter(item => item.type === 'dir'
                && !item.name.startsWith('.')
                && !IGNORED_ROOT_FOLDERS.has(item.name))
                .map(item => ({ name: item.name, repoPath: item.name }));
            const groupedFolder = rootItems.find(item => item.type === 'dir' && item.name === CUSTOM_CARDS_DIR);
            if (groupedFolder) {
                const groupedItems = await githubRequest(`${API_ROOT}/contents/${encodeRepoPath(CUSTOM_CARDS_DIR)}?ref=${BRANCH}`, token);
                groupedItems
                    .filter(item => item.type === 'dir' && !item.name.startsWith('.'))
                    .forEach(item => folders.push({ name: item.name, repoPath: `${CUSTOM_CARDS_DIR}/${item.name}` }));
            }

            const loaded = await Promise.all(folders.map(async folder => {
                try {
                    const indexFile = await getRepoFile(`${folder.repoPath}/index.html`, token, true);
                    return indexFile ? parseCard(folder.name, indexFile.text, folder.repoPath) : null;
                } catch (e) {
                    if (e.status === 401) throw e;
                    return null;
                }
            }));

            state.token = token;
            state.cards = loaded.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
            if (isInlineManager()) {
                sessionStorage.setItem(MANAGER_SESSION_KEY, token);
                document.getElementById('card-admin-token').value = '';
                setManagerAccess(account.login);
                if (!new URLSearchParams(location.search).has('tool')) document.getElementById('manager-coin-base')?.focus({ preventScroll: true });
            } else localStorage.setItem('gh_token', token);
            populateCardSelectors();
            const tools = document.getElementById('card-admin-tools');
            if (tools) tools.style.display = 'block';
            setStatus(`Signed in. Loaded ${state.cards.length} custom cards.`, 'success');
        } catch (error) {
            if (manager) {
                clearManagerSession();
                input.setAttribute('aria-invalid', 'true');
                setStatus(error.status ? `Sign-in failed (${error.status}). Try again.` : 'Unable to sign in. Try again.', 'error');
            } else setStatus(`Could not sign in to Manager: ${error.message}`, 'error');
        } finally {
            state.busy = false;
            if (manager) {
                input.disabled = false;
                if (button) { button.disabled = false; button.textContent = 'Sign In'; }
                document.getElementById('card-admin-auth').setAttribute('aria-busy', 'false');
                if (!state.token) input.focus();
            }
        }
    };

    async function commitRepositoryChanges(token, changes, deletePrefix, message) {
        if (isInlineManager() && window.ManagerAuth?.databaseMode) {
            throw Object.assign(new Error('GitHub card content writes are disabled while Manager uses database mode.'), { code: 'LEGACY_CONTENT_DISABLED' });
        }
        const htmlChanges = changes.filter(change => /\.html?$/i.test(String(change.path || '')));
        if (htmlChanges.length) {
            if (typeof window.assertGeneratedInlineScripts !== 'function') {
                throw new Error('HTML update stopped because inline-script validation is unavailable. Reload the editor and retry.');
            }
            htmlChanges.forEach(change => window.assertGeneratedInlineScripts(change.text, change.path));
        }

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

    async function buildMultiLinkChanges(baseCard, formCards, shouldLink, files = new Map()) {
        const affectedCards = [baseCard, ...formCards].filter(card => !files.has(card.repoPath));
        const allowUnmatchedFallback = formCards.length === 1;

        await Promise.all(affectedCards.map(async card => {
            const [htmlFile, jsonFile] = await Promise.all([
                getRepoFile(`${card.repoPath}/index.html`, state.token),
                getRepoFile(`${card.repoPath}/card.json`, state.token, true)
            ]);
            files.set(card.repoPath, {
                card,
                htmlPath: htmlFile.path,
                htmlText: htmlFile.text,
                jsonPath: jsonFile?.path || '',
                jsonText: jsonFile?.text || null
            });
        }));

        formCards.forEach(formCard => {
            const baseFile = files.get(baseCard.repoPath);
            const formFile = files.get(formCard.repoPath);

            baseFile.htmlText = updateLinkedHtml(baseFile.htmlText, baseCard, formCard, shouldLink, allowUnmatchedFallback);
            formFile.htmlText = updateLinkedHtml(formFile.htmlText, formCard, baseCard, shouldLink, allowUnmatchedFallback);

            if (baseFile.jsonText !== null) {
                baseFile.jsonText = updateLinkedJson(baseFile.jsonText, baseFile.htmlText, formCard, shouldLink, baseCard);
            }
            if (formFile.jsonText !== null) {
                formFile.jsonText = updateLinkedJson(formFile.jsonText, formFile.htmlText, baseCard, shouldLink, formCard);
            }
        });

        const changes = [];
        files.forEach(file => {
            changes.push({ path: file.htmlPath, text: file.htmlText });
            if (file.jsonText !== null) changes.push({ path: file.jsonPath, text: file.jsonText });
        });
        return { changes, files };
    }

    function getCoinCards() {
        if (window.ManagerAuth?.enabled) return state.cards.map(card => ({ ...card, links: card.linkedSlugs || [] }));
        return getLinkedCards(state.cards);
    }

    function normalizeContentCardSummary(value) {
        const outer = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
        const nested = outer?.card && typeof outer.card === 'object' && !Array.isArray(outer.card) ? outer.card : null;
        const source = nested ? { ...outer, ...nested } : outer;
        if (!source) return null;
        const id = typeof source.id === 'string' ? source.id : '';
        const slug = typeof source.slug === 'string' ? source.slug : id;
        const revision = source.revision;
        const status = source.status;
        if (!id || id.length > 160 || /[\/\\\u0000-\u001f]/.test(id) || id === '.' || id === '..'
            || slug !== id || !Number.isInteger(revision) || revision < 1
            || !['published', 'draft', 'archived'].includes(status)
            || !Array.isArray(source.linkedSlugs)
            || source.linkedSlugs.some(value => typeof value !== 'string')) return null;

        return {
            id,
            slug,
            revision,
            status,
            ...(typeof source.name === 'string' ? { name: source.name } : {}),
            ...(typeof source.title === 'string' ? { title: source.title } : {}),
            ...(typeof source.type === 'string' ? { type: source.type } : {}),
            ...(typeof source.rarity === 'string' || typeof source.rarity === 'number' ? { rarity: source.rarity } : {}),
            ...(typeof source.thumb === 'string' ? { thumb: source.thumb } : {}),
            ...(typeof source.repoPath === 'string' ? { repoPath: source.repoPath } : {}),
            ...(typeof source.assetBase === 'string' ? { assetBase: source.assetBase } : {}),
            linkedSlugs: [...new Set(source.linkedSlugs)].filter(slug => slug !== id)
        };
    }

    function mergeContentCardSummaries(values, archivedIds = []) {
        if (!Array.isArray(values)) return false;
        const knownIds = new Set(state.cards.map(card => card.id || card.slug));
        const updates = new Map();
        for (const value of values) {
            const summary = normalizeContentCardSummary(value);
            if (!summary || !knownIds.has(summary.id) || updates.has(summary.id)) return false;
            updates.set(summary.id, summary);
        }
        const archived = new Set(archivedIds);
        state.cards = state.cards
            .map(card => {
                const summary = updates.get(card.id || card.slug);
                return summary ? { ...card, ...summary } : card;
            })
            .filter(card => !archived.has(card.id || card.slug) && card.status !== 'archived');
        populateCardSelectors();
        return true;
    }

    function replaceContentCards(cards) {
        if (!Array.isArray(cards)) throw new Error('Manager returned an invalid database card catalog.');
        state.cards = cards.filter(card => card?.status !== 'archived');
        populateCardSelectors();
    }

    window.CardAdminCoins = {
        getSnapshot() {
            return { cards: getCoinCards(), busy: state.busy, authenticated: Boolean(state.serverSession || state.token) };
        },
        async applyPending({ baseSlug, add = [], remove = [], operations = null }) {
            if (window.ManagerAuth?.databaseMode) {
                if (state.busy || !state.serverSession) throw new Error('Sign in before applying changes.');
                const batches = operations || [{ baseSlug, add, remove }];
                const semantic = [];
                for (const batch of batches) {
                    if (batch?.action === 'link' || batch?.action === 'unlink') {
                        semantic.push({ action: batch.action, sourceSlug: batch.sourceSlug, targetSlug: batch.targetSlug });
                        continue;
                    }
                    const sourceSlug = batch?.baseSlug || baseSlug;
                    semantic.push(...[...new Set(batch?.remove || [])].map(targetSlug => ({ action: 'unlink', sourceSlug, targetSlug })));
                    semantic.push(...[...new Set(batch?.add || [])].map(targetSlug => ({ action: 'link', sourceSlug, targetSlug })));
                }
                const unique = new Map();
                for (const operation of semantic) {
                    if (!['link', 'unlink'].includes(operation.action)
                        || typeof operation.sourceSlug !== 'string' || typeof operation.targetSlug !== 'string'
                        || !operation.sourceSlug || !operation.targetSlug || operation.sourceSlug === operation.targetSlug) {
                        throw new Error('Choose distinct, available cards for each form relationship.');
                    }
                    const pairKey = [operation.sourceSlug, operation.targetSlug].sort().join('\u0000');
                    const previous = unique.get(pairKey);
                    if (previous && previous.action !== operation.action) {
                        throw new Error('A form pair cannot be both linked and unlinked in the same Apply operation.');
                    }
                    if (!previous) unique.set(pairKey, operation);
                }
                const contentOperations = [...unique.values()];
                if (!contentOperations.length) return;
                if (contentOperations.length > 100) throw new Error('Apply no more than 100 form changes at a time.');

                const cardBySlug = new Map(state.cards.map(card => [card.slug, card]));
                const expectedRevisions = Object.create(null);
                for (const operation of contentOperations) {
                    for (const slug of [operation.sourceSlug, operation.targetSlug]) {
                        const card = cardBySlug.get(slug);
                        if (!card || !Number.isInteger(card.revision) || card.revision < 1) {
                            throw new Error('Manager is missing a current card revision. Reload the database catalog and try again.');
                        }
                        expectedRevisions[card.id || card.slug] = card.revision;
                    }
                }

                state.busy = true;
                setStatus('Applying staged form links to the card database...');
                try {
                    const result = await window.ManagerAuth.contentRequest('/api/content/links/apply', {
                        method: 'POST',
                        body: { operations: contentOperations, expectedRevisions }
                    });
                    const expectedSummaryIds = new Set(contentOperations.flatMap(operation => [operation.sourceSlug, operation.targetSlug]));
                    const returnedSummaryIds = new Set(Array.isArray(result?.cards)
                        ? result.cards.map(card => card?.id || card?.slug).filter(id => typeof id === 'string')
                        : []);
                    const missingAffectedSummary = [...expectedSummaryIds].some(id => !returnedSummaryIds.has(id));
                    if (result?.schemaVersion !== 1 || !Array.isArray(result.cards)
                        || missingAffectedSummary || !mergeContentCardSummaries(result.cards)) {
                        const latest = await window.ManagerAuth.loadContentCatalog();
                        window.CardAdminServer.replaceContentCards(latest);
                    }
                    setStatus('Form link changes saved to the card database.', 'success');
                } catch (error) {
                    if (error.status === 401) window.CardAdminServer.clearSession();
                    if (error.code === 'REVISION_CONFLICT') {
                        try {
                            const latest = await window.ManagerAuth.loadContentCatalog();
                            window.CardAdminServer.replaceContentCards(latest);
                            setStatus('Another Manager edit changed a card. Saved links and revisions are refreshed; your staged changes remain. Review them and press Apply again.', 'error');
                        } catch (refreshError) {
                            setStatus(`The card changed in another Manager session. Your staged changes remain; reload the database catalog before applying again. ${refreshError.message}`, 'error');
                        }
                    } else {
                        setStatus(error.message, 'error');
                    }
                    throw error;
                } finally {
                    state.busy = false;
                    document.dispatchEvent(new Event('card-admin-cards-change'));
                }
                return;
            }
            if (window.ManagerAuth?.enabled) {
                if (state.busy || !state.serverSession) throw new Error('Sign in before applying changes.');
                const batches = operations || [{baseSlug,add,remove}];
                const semantic = batches.flatMap(batch => [
                    ...[...new Set(batch.remove || [])].map(targetSlug=>({action:'unlink',sourceSlug:batch.baseSlug,targetSlug})),
                    ...[...new Set(batch.add || [])].map(targetSlug=>({action:'link',sourceSlug:batch.baseSlug,targetSlug}))
                ]);
                if (!semantic.length) return;
                state.busy = true;
                setStatus('Applying staged form links...');
                try {
                    const result = await window.ManagerAuth.request('/api/links/apply',{method:'POST',body:{operations:semantic}});
                    state.cards = result.cards;
                    setStatus('Form link changes saved.','success');
                } catch (error) {
                    if (error.status === 401) window.CardAdminServer.clearSession();
                    setStatus(error.message,'error');
                    throw error;
                } finally {
                    state.busy = false;
                    document.dispatchEvent(new Event('card-admin-cards-change'));
                }
                return;
            }
            if (state.busy || !state.token) throw new Error('Sign in before applying changes.');
            const batches = operations || [{ baseSlug, add, remove }];
            const normalized = batches.map(batch => {
                const base = state.cards.find(card => card.slug === batch.baseSlug);
                const additions = [...new Set(batch.add || [])], removals = [...new Set(batch.remove || [])];
                if (!base || [...additions, ...removals].some(slug => slug === batch.baseSlug || !state.cards.some(card => card.slug === slug)) || additions.some(slug => removals.includes(slug))) {
                    throw new Error('Choose distinct, available cards for each association.');
                }
                return { base, additions, removals };
            }).filter(batch => batch.additions.length || batch.removals.length);
            if (!normalized.length) return;
            state.busy = true;
            setStatus('Applying staged form links...');
            try {
                const files = new Map();
                for (const batch of normalized) {
                    if (batch.removals.length) await buildMultiLinkChanges(batch.base, state.cards.filter(card => batch.removals.includes(card.slug)), false, files);
                    if (batch.additions.length) await buildMultiLinkChanges(batch.base, state.cards.filter(card => batch.additions.includes(card.slug)), true, files);
                }
                const changes = [...files.values()].flatMap(file => [{ path: file.htmlPath, text: file.htmlText }, ...(file.jsonText === null ? [] : [{ path: file.jsonPath, text: file.jsonText }])]);
                await commitRepositoryChanges(state.token, changes, '', `Update custom form links (${normalized.length} selected card${normalized.length === 1 ? '' : 's'})`);
                files.forEach(file => { file.card.htmlText = file.htmlText; });
                localStorage.removeItem('hub_cached_custom_only');
                setStatus('Form link changes saved.', 'success');
            } catch (error) {
                setStatus(`Could not save form links: ${error.message}`, 'error');
                throw error;
            } finally {
                state.busy = false;
                document.dispatchEvent(new Event('card-admin-cards-change'));
            }
        }
    };

    async function runMultiLinkOperation(shouldLink) {
        if (state.busy) return;
        if (!state.token || !state.cards.length) {
            setStatus('Sign in and load the custom cards first.', 'error');
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
            if (window.CardHubToast) window.CardHubToast.error('Operation Failed', { detail: error.message });
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
        if (window.ManagerAuth?.databaseMode) {
            const pending = window.ManagerLinkerCoins?.getState?.().staged?.length || 0;
            if (pending) {
                setStatus('Apply or discard staged form changes before archiving a card.', 'error');
                return;
            }
            const card = selectedCard('card-admin-delete-select');
            const confirmSlug = document.getElementById('card-admin-delete-confirm')?.value.trim() || '';
            if (!state.serverSession || !card || confirmSlug !== card.slug
                || !Number.isInteger(card.revision) || card.revision < 1) {
                setStatus('Select a card, type its exact folder name, and reload if its revision is unavailable.', 'error');
                return;
            }

            const id = card.id || card.slug;
            state.busy = true;
            setStatus(`Archiving ${card.name} from the public catalog...`);
            try {
                const result = await window.ManagerAuth.contentRequest(`/api/content/cards/${encodeURIComponent(id)}/archive`, {
                    method: 'POST',
                    body: { expectedRevision: card.revision }
                });
                const expectedSummaryIds = new Set([id, ...(card.linkedSlugs || [])]);
                const returnedSummaryIds = new Set(Array.isArray(result?.cards)
                    ? result.cards.map(summary => summary?.id || summary?.slug).filter(summaryId => typeof summaryId === 'string')
                    : []);
                const missingAffectedSummary = [...expectedSummaryIds].some(summaryId => !returnedSummaryIds.has(summaryId));
                if (result?.schemaVersion !== 1 || result.archivedId !== id || !Array.isArray(result.cards)
                    || missingAffectedSummary || !mergeContentCardSummaries(result.cards, [id])) {
                    const latest = await window.ManagerAuth.loadContentCatalog();
                    window.CardAdminServer.replaceContentCards(latest);
                }
                document.getElementById('card-admin-delete-confirm').value = '';
                setStatus(`${card.name} was archived from public pages. Its database record is preserved.`, 'success');
            } catch (error) {
                if (error.status === 401) window.CardAdminServer.clearSession();
                if (error.code === 'REVISION_CONFLICT') {
                    try {
                        const latest = await window.ManagerAuth.loadContentCatalog();
                        window.CardAdminServer.replaceContentCards(latest);
                        setStatus('This card changed in another Manager session. The latest catalog is loaded; review it before archiving again.', 'error');
                    } catch (refreshError) {
                        setStatus(`This card changed in another Manager session. Reload the database catalog before archiving again. ${refreshError.message}`, 'error');
                    }
                } else {
                    setStatus(error.message, 'error');
                }
            } finally {
                state.busy = false;
                document.dispatchEvent(new Event('card-admin-cards-change'));
            }
            return;
        }
        if (window.ManagerAuth?.enabled) {
            const card = selectedCard('card-admin-delete-select');
            const confirmSlug = document.getElementById('card-admin-delete-confirm')?.value || '';
            if (!state.serverSession || !card || confirmSlug !== card.slug) {
                setStatus('Select a card and type its exact folder name to confirm deletion.','error');
                return;
            }
            state.busy = true;
            setStatus(`Deleting ${card.name} and cleaning its form links...`);
            try {
                const result = await window.ManagerAuth.request('/api/cards/delete',{method:'POST',body:{slug:card.slug,confirmSlug}});
                state.cards = result.cards;
                populateCardSelectors();
                setStatus(`${card.name} was deleted from GitHub.`,'success');
            } catch (error) {
                if (error.status === 401) window.CardAdminServer.clearSession();
                setStatus(error.message,'error');
            } finally {
                state.busy = false;
                document.dispatchEvent(new Event('card-admin-cards-change'));
            }
            return;
        }
        if (!state.token || !state.cards.length) {
            setStatus('Sign in and load the custom cards first.', 'error');
            return;
        }

        const card = selectedCard('card-admin-delete-select');
        const confirmation = document.getElementById('card-admin-delete-confirm')?.value.trim() || '';
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

                cleanupChanges.push({ path: `${other.repoPath}/index.html`, text: updatedHtml });
                const otherJson = await getRepoFile(`${other.repoPath}/card.json`, state.token, true);
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
                card.repoPath,
                `Delete custom card: ${card.slug}`
            );

            localStorage.removeItem('hub_cached_custom_only');
            state.cards = state.cards.filter(item => item.slug !== card.slug);
            populateCardSelectors();
            setStatus(`${card.name} was deleted from GitHub. This cannot be undone from the editor.`, 'success');
            if (window.CardHubToast) {
                window.CardHubToast.success('Card Deleted', { detail: card.name + ' removed from GitHub.', duration: 5000 });
            }
        } catch (error) {
            setStatus(`The card could not be deleted: ${error.message}`, 'error');
            if (window.CardHubToast) window.CardHubToast.error('Delete Failed', { detail: error.message });
        } finally {
            state.busy = false;
        }
    };
    window.CardAdminServer = {
        setSession(session, cards) {
            state.token = '';
            state.serverSession = session;
            state.cards = cards;
            setManagerAccess(session.login);
            populateCardSelectors();
        },
        mergeContentSummaries(summaries, archivedIds = []) {
            return mergeContentCardSummaries(summaries, archivedIds);
        },
        replaceContentCards(cards) {
            replaceContentCards(cards);
        },
        clearSession() {
            clearManagerSession();
            populateCardSelectors();
        }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.initCardAdminManager, { once: true });
    else window.initCardAdminManager();
})();
