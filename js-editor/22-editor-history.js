/* Session-only editor history backed by the existing autosave payload. */
(() => {
    const MAX_HISTORY_ENTRIES = 24;
    const MAX_HISTORY_ASSET_BYTES = 64 * 1024 * 1024;
    const DATA_URL_PATTERN = /data:[^"'\s<>]+/gi;
    const ASSET_TOKEN_PATTERN = /__EDITOR_HISTORY_ASSET_(\d+)__/g;
    const state = {
        entries: [],
        assets: new Map(),
        assetIds: new Map(),
        assetBytes: 0,
        nextAssetId: 1,
        nextEntryId: 1,
        lastComparablePayload: '',
        changeVersion: 0,
        pendingDescription: ''
    };

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function packPayload(payload) {
        return String(payload).replace(DATA_URL_PATTERN, dataUrl => {
            let token = state.assetIds.get(dataUrl);
            if (!token) {
                token = `__EDITOR_HISTORY_ASSET_${state.nextAssetId++}__`;
                state.assetIds.set(dataUrl, token);
                state.assets.set(token, dataUrl);
                state.assetBytes += dataUrl.length * 2;
            }
            return token;
        });
    }

    function comparablePayload(packedPayload) {
        try {
            const data = JSON.parse(packedPayload);
            delete data._autosaveSavedAt;
            return JSON.stringify(data);
        } catch (error) {
            return packedPayload;
        }
    }

    function pruneUnusedAssets() {
        const used = new Set();
        state.entries.forEach(entry => {
            for (const match of entry.payload.matchAll(ASSET_TOKEN_PATTERN)) used.add(`__EDITOR_HISTORY_ASSET_${match[1]}__`);
        });
        for (const [token, dataUrl] of state.assets) {
            if (used.has(token)) continue;
            state.assets.delete(token);
            state.assetIds.delete(dataUrl);
            state.assetBytes -= dataUrl.length * 2;
        }
        state.assetBytes = Math.max(0, state.assetBytes);
    }

    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
    }

    function normalizeDescription(description) {
        const value = String(description || '').replace(/\s+/g, ' ').trim();
        return value || 'Edited card details';
    }

    window.EditorSessionHistory = {
        beginCapture(fallbackDescription = '') {
            return {
                description: normalizeDescription(state.pendingDescription || fallbackDescription || 'Edited card details'),
                version: state.changeVersion
            };
        },

        record(payload, capture = null) {
            if (!payload) return false;
            const packed = packPayload(payload);
            const comparable = comparablePayload(packed);
            if (comparable === state.lastComparablePayload) {
                if (capture && capture.version === state.changeVersion) state.pendingDescription = '';
                pruneUnusedAssets();
                return false;
            }

            const timestamp = Date.now();
            state.entries.push({
                id: state.nextEntryId++,
                description: normalizeDescription(capture?.description || state.pendingDescription),
                timestamp,
                payload: packed
            });
            state.lastComparablePayload = comparable;
            if (capture && capture.version === state.changeVersion) state.pendingDescription = '';

            while (state.entries.length > MAX_HISTORY_ENTRIES) state.entries.shift();
            pruneUnusedAssets();
            while (state.assetBytes > MAX_HISTORY_ASSET_BYTES && state.entries.length > 1) {
                state.entries.shift();
                pruneUnusedAssets();
            }
            if (state.assetBytes > MAX_HISTORY_ASSET_BYTES && state.entries.length === 1) {
                state.entries.pop();
                state.lastComparablePayload = '';
                pruneUnusedAssets();
                return false;
            }
            return true;
        },

        markChange(description) {
            state.changeVersion += 1;
            state.pendingDescription = normalizeDescription(description);
        },

        getEntries() {
            return state.entries.map(({ id, description, timestamp }) => ({ id, description, timestamp }));
        },

        materialize(entryId) {
            const entry = state.entries.find(candidate => candidate.id === Number(entryId));
            if (!entry) return null;
            let payload = entry.payload;
            for (const [token, dataUrl] of state.assets) payload = payload.split(token).join(dataUrl);
            return payload;
        },

        getScopeLabel() {
            return 'History is kept only for this browser session. It clears when this page is reloaded or closed.';
        }
    };

    function changeDescription(target, eventType) {
        if (!target || target.closest?.('#editor-history-dialog')) return '';
        if (target.matches?.('#gui-links-search, #gui-categories-search, .context-visual-search')) return '';

        const idDescriptions = {
            'gui-sa-effects': 'Edited Super Attack effect text',
            'gui-sa-activation': 'Edited Super Attack activation conditions',
            'gui-sa-name': 'Renamed a Super Attack',
            'gui-sa-ki': 'Changed Super Attack Ki',
            'gui-sa-stat-val': 'Changed a Super Attack stat value',
            'gui-active-name': 'Renamed a skill',
            'gui-active-effect': 'Edited a skill effect',
            'gui-active-conditions': 'Edited skill activation conditions',
            'gui-passive-name': 'Renamed the Passive Skill',
            'gui-category-search': '',
            'gui-links-search': ''
        };
        if (Object.prototype.hasOwnProperty.call(idDescriptions, target.id)) return idDescriptions[target.id];

        const choice = target.closest?.('[data-visual-choice]');
        if (choice) return `Changed ${choice.dataset.visualKind === 'categories' ? 'category' : 'Link Skill'} selection`;

        if (eventType === 'click') {
            const button = target.closest?.('button');
            if (!button || button.matches('#editor-history-button, [data-history-close], [data-history-restore]')) return '';
            const label = String(button.getAttribute('aria-label') || button.title || button.textContent || '')
                .replace(/\s+/g, ' ').trim();
            if (!label) return '';
            if (/^(?:cancel|close|done|history|symbols|previous|next|all sections)$/i.test(label)) return '';
            if (/^undo$/i.test(label)) return 'Restored a deleted section';
            if (button.classList?.contains('sa-gui-icon-opt')) return `Selected stat effect icon ${label}`;
            if (/delete/i.test(label)) return `Deleted ${label.replace(/^delete\s+/i, '')}`;
            if (/add/i.test(label)) return `Added ${label.replace(/^add\s+/i, '')}`;
            if (/apply/i.test(label) && target.closest?.('[data-visual-picker="categories"]')) return 'Applied category selections';
            if (/apply/i.test(label) && target.closest?.('[data-visual-picker="links"]')) return 'Applied Link Skill selections';
            return `Changed ${label}`;
        }

        if (eventType === 'input' || eventType === 'change') {
            const label = target.labels?.[0]?.textContent || target.getAttribute?.('aria-label') || target.placeholder || '';
            const cleanLabel = String(label).replace(/\s+/g, ' ').trim();
            if (cleanLabel) {
                const section = target.closest?.('#context-gui')?.dataset?.contextType;
                const prefix = section === 'passive' ? 'Passive Skill' : section === 'sa' ? 'Super Attack' : section === 'active' ? 'Skill' : 'Card';
                return `Edited ${prefix} ${cleanLabel.toLowerCase()}`;
            }
        }
        return '';
    }

    document.addEventListener('input', event => {
        const description = changeDescription(event.target, 'input');
        if (description) window.EditorSessionHistory.markChange(description);
    }, true);
    document.addEventListener('change', event => {
        const description = changeDescription(event.target, 'change');
        if (description) window.EditorSessionHistory.markChange(description);
    }, true);
    document.addEventListener('click', event => {
        const description = changeDescription(event.target, 'click');
        if (description) window.EditorSessionHistory.markChange(description);
    }, true);

    function renderEntries() {
        const list = document.getElementById('editor-history-list');
        if (!list) return;
        const entries = window.EditorSessionHistory.getEntries();
        if (!entries.length) {
            list.innerHTML = '<div class="editor-history-empty">No saved edits in this session yet.</div>';
            return;
        }
        list.innerHTML = entries.map(entry => `
            <article class="editor-history-entry">
                <div class="editor-history-entry-copy">
                    <div class="editor-history-entry-title">${escapeHtml(entry.description)}</div>
                    <time datetime="${new Date(entry.timestamp).toISOString()}">${escapeHtml(formatTimestamp(entry.timestamp))}</time>
                </div>
                <button type="button" class="gui-preset-btn" data-history-restore="${entry.id}" aria-label="Restore ${escapeHtml(entry.description)}">Restore</button>
            </article>`).join('');
    }

    function ensureHistoryDialog() {
        let dialog = document.getElementById('editor-history-dialog');
        if (dialog) return dialog;
        dialog = document.createElement('dialog');
        dialog.id = 'editor-history-dialog';
        dialog.className = 'editor-history-dialog';
        dialog.setAttribute('aria-labelledby', 'editor-history-title');
        dialog.innerHTML = `
            <section class="editor-history-panel">
                <header class="editor-history-header">
                    <div>
                        <h2 id="editor-history-title">Recent edits</h2>
                        <p class="editor-history-scope">${escapeHtml(window.EditorSessionHistory.getScopeLabel())}</p>
                    </div>
                    <button type="button" class="gui-preset-btn" data-history-close aria-label="Close history">Close</button>
                </header>
                <div class="editor-history-list" id="editor-history-list" aria-label="Recent edits, oldest to newest"></div>
                <footer class="editor-history-footer">
                    <button type="button" class="gui-preset-btn" data-history-close>Done</button>
                </footer>
            </section>`;
        dialog.addEventListener('click', async event => {
            if (event.target === dialog || event.target.closest?.('[data-history-close]')) {
                dialog.close?.();
                dialog.removeAttribute('open');
                return;
            }
            const restoreButton = event.target.closest?.('[data-history-restore]');
            if (restoreButton) await restoreHistoryEntry(restoreButton.dataset.historyRestore);
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    async function restoreHistoryEntry(entryId) {
        const entry = window.EditorSessionHistory.getEntries().find(candidate => candidate.id === Number(entryId));
        const savedPayload = window.EditorSessionHistory.materialize(entryId);
        if (!entry || !savedPayload) return;
        const time = formatTimestamp(entry.timestamp);
        const confirmed = window.confirm(
            `Restore “${entry.description}” from ${time}? This replaces the current card edits. The current state will be autosaved first. History lasts only until this page is reloaded or closed.`
        );
        if (!confirmed) return;

        try {
            const currentSaved = await window.autoSaveToCache?.({ silent: true, historyDescription: 'Saved current edits before restore' });
            if (currentSaved === false) throw new Error('The current edits could not be saved, so History was not restored.');
            const data = JSON.parse(savedPayload);
            data._autosaveSavedAt = Date.now();
            await window.EditorAutosaveStore.save(JSON.stringify(data), Date.now());
            window.location.reload();
        } catch (error) {
            console.error('Could not restore editor history:', error);
            window.CardHubToast?.error('History restore failed', {
                detail: error?.message || 'The selected state could not be restored.',
                duration: 7000
            });
        }
    }

    window.openEditorHistory = async function() {
        if (window.IS_PUBLISHED && window.ADMIN_MODE !== true) return;
        try {
            await window.autoSaveToCache?.({ silent: true });
        } catch (error) {
            // The autosave path already reports storage failures. Existing
            // session entries remain available for restore.
        }
        const dialog = ensureHistoryDialog();
        renderEntries();
        if (!dialog.open) {
            if (typeof dialog.showModal === 'function') dialog.showModal();
            else dialog.setAttribute('open', '');
        }
    };

    Promise.resolve().then(async () => {
        try {
            const record = await window.EditorAutosaveStore?.readLatest?.();
            if (record?.payload) {
                window.EditorSessionHistory.record(record.payload, {
                    description: 'Opened saved card',
                    version: state.changeVersion
                });
            }
        } catch (error) {
            // The editor can still build history from successful saves made in
            // this page session when an older cache cannot be read.
        }
    });
})();
