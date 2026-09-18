/* ========================================================================== 
   absCustom - Local official-card animation preview bridge with ActionBank Lua Sequencer
   ========================================================================== */

(function initializeDokkanAnimationPlayer() {
    const LOCAL_SERVER = 'http://127.0.0.1:3137';
    const STATIC_INDEX_BASE = 'https://raw.githubusercontent.com/abscustom/DokkanCustom-animation-index/main';
    const GITHUB_RELEASE_BASE = 'https://github.com/abscustom/DokkanCustom/releases/download/assets-latest';
    const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/abscustom/DokkanCustom/main/assets';
    const REMOTE_SERVER = STATIC_INDEX_BASE;
    const NGROK_SERVER = STATIC_INDEX_BASE;
    // Track cache state per connection (0 = unknown, 1 = connected, 2 = failed)
    const serverState = new Map();

    function isLocalEnvironment() {
        return window.location.protocol === 'file:'
            || window.location.hostname === 'localhost'
            || window.location.hostname === '127.0.0.1'
            || !window.location.hostname;
    }

    function isStaticServer(server) {
        return !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(server);
    }

    const DEFAULT_SERVER = isLocalEnvironment() ? LOCAL_SERVER : STATIC_INDEX_BASE;
    const SCRIPT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
    const BRIDGE_REQUEST_TIMEOUT_MS = 5000;
    const urlServerOverride = new URLSearchParams(window.location.search).get('animationServer');
    let playerModulePromise = null;
    let runnerModulePromise = null;
    let usmModulePromise = null;
    let actionBankRunner = null;
    let activePlayers = [];
    let activeEffect = null;
    let activeEffectOptions = null;
    let activePayload = null;
    let activeMode = 'sequence'; // 'sequence' | 'composite' | 'single' | 'ko'
    let activeAnimationContext = 'sa1';
    let is2xSpeed = false;
    let masterVolume = Math.max(0, Math.min(1, Number(localStorage.getItem('dokkan-animation-volume')) || 0.8));
    const koAvailability = new Map();
    const animationAvailability = new Map();
    const animationAvailabilityRequests = new Map();
    const animationResponseServers = new WeakMap();

    const VALID_ANIMATION_CONTEXTS = new Set(['sa1', 'sa2', 'active', 'standby', 'finish', 'passive', 'counter', 'nullification']);

    function normalizeAnimationContext(value) {
        const context = String(value || '').toLowerCase();
        return VALID_ANIMATION_CONTEXTS.has(context) ? context : 'sa1';
    }

    // Official animations are authored in two portrait canvases, never an
    // arbitrary video size.  The 852×1136 group also covers card art (426×568
    // is the same 3:4 ratio), while the other group is 852×1536.
    function setAnimationViewport(animationContext, payload = null, requestedMode = 'sequence') {
        const stage = document.querySelector('.abs-animation-stage-wrap');
        if (!stage) return;
        const context = normalizeAnimationContext(animationContext);
        const source = String(payload?.lua_source || '');
        const activeHasAttack = /\bdealDamage\s*\(/.test(source);
        const isTall = context === 'passive'
            || context === 'standby'
            || context === 'counter'
            || (context === 'active' && (!payload || !activeHasAttack));

        // KO previews inherit the script's framing. A Super/Finish KO is the
        // standard 852×1136 format; active/intro/standby/counter previews stay
        // in the taller frame above.
        stage.classList.toggle('is-tall', isTall);
        stage.dataset.animationViewport = isTall ? '852x1536' : '852x1136';
    }

    function getAnimationViewportDimensions() {
        const stage = document.querySelector('.abs-animation-stage-wrap');
        return stage?.dataset.animationViewport === '852x1536'
            ? { width: 852, height: 1536 }
            : { width: 852, height: 1136 };
    }

    function getServerUrl() {
        if (urlServerOverride) return urlServerOverride.replace(/\/$/, '');
        const saved = localStorage.getItem('absDokkanAnimationServer');
        if (saved) {
            const normalized = saved.replace(/\/$/, '');
            // When running locally, do not get trapped by a stale remote ngrok URL in localStorage
            if (isLocalEnvironment() && (saved.includes('ngrok') || saved.includes('loca.lt') || saved.includes('raw.githubusercontent.com'))) {
                return LOCAL_SERVER;
            }
            // A deployed page must never probe a loopback server from the
            // visitor's machine because that setting may have been saved by a
            // local checkout in the same browser profile.
            if (!isLocalEnvironment() && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(normalized)) {
                return STATIC_INDEX_BASE;
            }
            return normalized;
        }
        return isLocalEnvironment() ? LOCAL_SERVER : STATIC_INDEX_BASE;
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = BRIDGE_REQUEST_TIMEOUT_MS) {
        if (typeof AbortController !== 'function') return fetch(url, options);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    function tagAnimationResponse(response, server) {
        if (response && server) animationResponseServers.set(response, server);
        return response;
    }

    function getAnimationResponseServer(response, fallback = '') {
        return animationResponseServers.get(response) || fallback;
    }

    function formatBridgeEndpoint(endpoint, server) {
        if (!endpoint || endpoint.endsWith('.json')) return endpoint;
        if (isStaticServer(server)) {
            const [pathPart, query] = endpoint.split('?');
            return query ? `${pathPart}.json?${query}` : `${pathPart}.json`;
        }
        return endpoint;
    }

    async function fetchFromAnimationBridge(endpoint, options = {}) {
        let server = getServerUrl();
        const buildHeaders = (targetServer) => {
            const h = { ...(options.headers || {}) };
            if (targetServer && (targetServer.includes('ngrok') || targetServer.includes('loca.lt'))) {
                h['ngrok-skip-browser-warning'] = 'true';
                h['Bypass-Tunnel-Reminder'] = 'true';
            }
            return h;
        };
        const reqEndpoint = formatBridgeEndpoint(endpoint, server);
        try {
            const res = await fetchWithTimeout(`${server}${reqEndpoint}`, { ...options, headers: buildHeaders(server) });
            if (res.ok) return tagAnimationResponse(res, server);
            if (res.status === 502 || res.status === 504 || res.status === 503) {
                throw new Error(`Bridge returned ${res.status}`);
            }
            return tagAnimationResponse(res, server);
        } catch (err) {
            const altServer = server === LOCAL_SERVER ? STATIC_INDEX_BASE : LOCAL_SERVER;
            // Only a local page may try the local bridge as a fallback. A
            // public page must not leak a visitor's loopback endpoint into its
            // media requests.
            if (isLocalEnvironment()) {
                try {
                    const altEndpoint = formatBridgeEndpoint(endpoint, altServer);
                    const altRes = await fetchWithTimeout(`${altServer}${altEndpoint}`, { ...options, headers: buildHeaders(altServer) });
                    if (altRes && (altRes.ok || altRes.status < 500)) {
                        if (actionBankRunner) actionBankRunner.setServerUrl(altServer);
                        return tagAnimationResponse(altRes, altServer);
                    }
                } catch {}
            }
            throw err;
        }
    }

    function resolveBridgeMediaUrl(value, server) {
        const raw = String(value || '');
        if (!raw || !server || /^(?:data|blob):/i.test(raw)) return value;
        if (/^https?:\/\//i.test(raw)) return raw;
        try {
            const resolved = new URL(raw, server);
            if (!/^https?:$/i.test(resolved.protocol) || !/^\/(?:assets|api)\//i.test(resolved.pathname)) {
                return value;
            }
            const origin = new URL(server).origin;
            return `${origin}${resolved.pathname}${resolved.search}${resolved.hash}`;
        } catch {
            return value;
        }
    }

    function normalizeAnimationPayload(payload, server) {
        if (!payload || typeof payload !== 'object' || !server) return payload;
        const normalizeEffect = (effect) => {
            if (!effect || typeof effect !== 'object') return effect;
            if (effect.movie_url) effect.movie_url = resolveBridgeMediaUrl(effect.movie_url, server);
            if (effect.movie_fallback_url) effect.movie_fallback_url = resolveBridgeMediaUrl(effect.movie_fallback_url, server);
            if (Array.isArray(effect.files)) {
                effect.files = effect.files.map((file) => ({
                    ...file,
                    url: resolveBridgeMediaUrl(file?.url, server),
                }));
            }
            return effect;
        };
        if (Array.isArray(payload.effects)) payload.effects = payload.effects.map(normalizeEffect);
        else normalizeEffect(payload);
        return payload;
    }

    function hasPlayableAnimationPayload(payload) {
        const effects = Array.isArray(payload?.effects) ? payload.effects : [];
        return effects.some((effect) => {
            if (!effect || effect.available === false) return false;
            const files = Array.isArray(effect.files) ? effect.files : [];
            const hasLwf = files.some((file) => {
                const name = typeof file === 'string' ? file : (file?.name || file?.url || '');
                return /\.lwf(?:$|[?#])/i.test(String(name));
            });
            const hasMovie = effect.has_movie === true && Boolean(effect.movie_url);
            return hasLwf || hasMovie;
        });
    }

    function setAnimationButtonAvailability(scriptName, available) {
        const script = normalizeScriptKey(scriptName);
        if (!script) return;
        const visible = Boolean(available);
        document.querySelectorAll('.abs-animation-header-actions').forEach((wrapper) => {
            const wrapperScript = normalizeScriptKey(
                wrapper.dataset.animationScript
                    || wrapper.querySelector('[data-animation-script]')?.dataset.animationScript,
            );
            if (wrapperScript !== script) return;
            wrapper.dataset.animationAvailable = visible ? 'true' : 'false';
            wrapper.hidden = !visible;
            wrapper.querySelectorAll('.abs-animation-play-btn').forEach((button) => {
                const isKo = button.classList.contains('abs-animation-ko-launch');
                button.hidden = !visible || (isKo && koAvailability.get(script) !== true);
            });
        });
    }

    function probeAnimationScript(scriptName) {
        const script = normalizeScriptKey(scriptName);
        if (!SCRIPT_NAME_PATTERN.test(String(scriptName || ''))) return Promise.resolve(false);
        if (animationAvailability.has(script)) return Promise.resolve(animationAvailability.get(script));
        if (animationAvailabilityRequests.has(script)) return animationAvailabilityRequests.get(script);

        const request = Promise.resolve().then(async () => {
            const response = await fetchFromAnimationBridge(`/api/animation/${encodeURIComponent(String(scriptName))}`, { cache: 'no-store' });
            if (!response.ok) return false;
            const payload = normalizeAnimationPayload(
                await response.json().catch(() => null),
                getAnimationResponseServer(response, getServerUrl()),
            );
            await hydrateReferencedEffects(payload);
            return hasPlayableAnimationPayload(payload);
        }).catch(() => false).then((available) => {
            animationAvailability.set(script, available);
            animationAvailabilityRequests.delete(script);
            setAnimationButtonAvailability(scriptName, available);
            return available;
        });
        animationAvailabilityRequests.set(script, request);
        return request;
    }

    function hydrateAnimationButton(wrapper) {
        const scriptName = String(
            wrapper?.dataset?.animationScript
                || wrapper?.querySelector?.('[data-animation-script]')?.dataset?.animationScript
                || '',
        ).trim();
        if (!wrapper || !SCRIPT_NAME_PATTERN.test(scriptName) || wrapper.dataset.animationChecked === '1') return;
        wrapper.dataset.animationChecked = '1';
        wrapper.hidden = true;
        wrapper.querySelectorAll('.abs-animation-play-btn').forEach((button) => { button.hidden = true; });
        if (animationAvailability.has(normalizeScriptKey(scriptName))) {
            setAnimationButtonAvailability(scriptName, animationAvailability.get(normalizeScriptKey(scriptName)));
            return;
        }
        probeAnimationScript(scriptName);
    }

    function hydrateAnimationButtons(root = document) {
        if (root?.matches?.('.abs-animation-header-actions')) hydrateAnimationButton(root);
        root?.querySelectorAll?.('.abs-animation-header-actions').forEach(hydrateAnimationButton);
    }

    function normalizeScriptKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    function getCurrentCardId() {
        return Number(window.__absCurrentAnimationCardId || window.currentCard?.id) || 1000010;
    }

    function getSpecialView(viewId) {
        if (!viewId || !window.DB?.specialViews) return null;
        return DB.specialViews[String(viewId)] || DB.specialViews[viewId] || null;
    }

    function scriptFromViewId(viewId) {
        const scriptName = getSpecialView(viewId)?.script_name;
        return SCRIPT_NAME_PATTERN.test(String(scriptName || '')) ? String(scriptName) : '';
    }

    function resolveSuperAttackViewId(specObj, card) {
        if (!specObj || !card) return 0;
        let viewId = specObj.special_view_id || specObj.view_id || 0;
        if (!viewId && window.DB?.cardSpecialsByCard) {
            const relationalRows = DB.cardSpecialsByCard[String(card.id)] || [];
            const match = relationalRows.find((row) =>
                String(row.special_set_id || '') === String(specObj.special_set_id || specObj.id || '')
                && Number(row.eball_num_start || 0) === Number(specObj.eball_num_start || 0)
            ) || relationalRows.find((row) =>
                String(row.special_set_id || '') === String(specObj.special_set_id || specObj.id || '')
            );
            viewId = match?.view_id || match?.bonus_view_id1 || match?.bonus_view_id2 || 0;
        }
        return Number(viewId) || 0;
    }

    function resolveSuperAttack(specObj, card) {
        return scriptFromViewId(resolveSuperAttackViewId(specObj, card));
    }

    function resolveSuperAttackContext(specObj, card, fallbackIndex = 0) {
        const view = getSpecialView(resolveSuperAttackViewId(specObj, card));
        const specialNameNumber = Number(view?.special_name_no || 0);
        return specialNameNumber >= 2 || Number(fallbackIndex) > 0 ? 'sa2' : 'sa1';
    }

    function resolveSkill(skillObj) {
        if (!skillObj) return '';
        return scriptFromViewId(
            skillObj.special_view_id
            || skillObj.view_id
            || skillObj.costume_special_view_id
            || 0
        );
    }

    function resolvePassive(card) {
        if (!card || !window.DB?.passiveEffectViews) return '';
        const passiveSetId = card.pass_id || card.passive_skill_set_id || card.passive_id || 0;
        const views = DB.passiveEffectViews[String(passiveSetId)] || [];
        const scriptName = views[0]?.script_name || '';
        return SCRIPT_NAME_PATTERN.test(String(scriptName)) ? String(scriptName) : '';
    }

    function classifyReactionText(text, kind = 'counter') {
        const value = String(text || '').toLowerCase();
        const isNullification = kind === 'nullification';
        if (/(?:unarmed|melee|physical)\s+super\s+attack/.test(value)) return isNullification ? 'Melee Nullification' : 'Melee Counter';
        if (/(?:ki\s*blast|energy)\s+super\s+attack/.test(value)) return isNullification ? 'Ki Blast Nullification' : 'Ki Blast Counter';
        if (isNullification) return 'Nullification';
        if (/normal\s+attacks?/.test(value)) return 'Normal Counter';
        if (/super\s+attack/.test(value)) return 'Super Counter';
        return 'Counter';
    }

    // Counter Lua is deliberately resolved by the local database service,
    // rather than guessed from passive wording. The game stores the modern
    // c#### suffix in the passive effects and older counter Lua files carry
    // an owning-card ID in their official header comments.
    async function mountCounterControls(card, passiveObj, container) {
        if (!card || !container) return;
        const passiveText = passiveObj?.itemized_description || passiveObj?.description || '';
        if (!/(?:counter|nullif)/i.test(passiveText)) return;

        const cardId = Number(card.id);
        if (!Number.isInteger(cardId) || cardId <= 0) return;
        const requestKey = `${cardId}:${String(passiveText).length}`;
        container.dataset.absCounterRequest = requestKey;
        container.querySelectorAll('.abs-counter-animation-actions').forEach((node) => node.remove());

        try {
            const response = await fetchFromAnimationBridge(`/api/counters/${encodeURIComponent(String(cardId))}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || container.dataset.absCounterRequest !== requestKey) return;
            const scripts = Array.isArray(payload?.scripts) ? payload.scripts : [];
            if (!scripts.length) return;

            const actions = document.createElement('span');
            actions.className = 'abs-counter-animation-actions';
            actions.innerHTML = scripts.map((entry) => {
                const kind = entry?.kind === 'nullification' ? 'nullification' : 'counter';
                const label = `Play ${classifyReactionText(passiveText, kind)}`;
                return buttonHtml(entry?.script_name, label, kind);
            }).join('');
            const targetContainer = container.querySelector('.abs-passive-header-actions')
                || container.querySelector('.abs-passive-header-title')
                || container;
            if (actions.children.length) targetContainer.appendChild(actions);
        } catch (error) {
            // The inspector remains fully usable when the optional local
            // animation server is stopped; the standard Play controls follow
            // the same graceful behavior.
            console.debug('Counter animation lookup unavailable:', error);
        }
    }

    function escapeAttr(str) {
        return String(str || '').replace(/["'<>&]/g, (c) => {
            return c === '"' ? '&quot;' : c === "'" ? '&#39;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;';
        });
    }

    function buttonHtml(scriptName, label = 'Play animation', animationContext = 'sa1') {
        if (!SCRIPT_NAME_PATTERN.test(String(scriptName || ''))) return '';
        const safeScript = String(scriptName).replace(/[^A-Za-z0-9_-]/g, '');
        const safeLabel = String(label).replace(/['"\\`]/g, '');
        const safeContext = normalizeAnimationContext(animationContext);
        const attrLabel = escapeAttr(label);

        let buttonText = '';
        if (safeContext === 'passive') {
            buttonText = 'Play Intro';
        } else if (safeContext === 'counter' || safeContext === 'nullification') {
            const cleanReaction = String(label || 'Counter').replace(/^Play\s+/i, '').replace(/\s+Animation$/i, '').trim();
            buttonText = cleanReaction ? `Play ${cleanReaction}` : 'Play Counter';
        }

        // Only Action Skills (Super Attack, Active, Standby, Finish) can trigger a KO screen
        const canHaveKo = safeContext === 'sa1' || safeContext === 'sa2' || safeContext === 'active' || safeContext === 'standby' || safeContext === 'finish';

        return `
            <span class="abs-animation-header-actions" data-animation-script="${safeScript}">
                <button type="button"
                        class="abs-animation-play-btn${buttonText ? ' abs-animation-play-btn--with-text' : ''}"
                        title="${attrLabel}: ${safeScript}"
                        aria-label="${attrLabel}"
                        data-animation-script="${safeScript}"
                        data-animation-context="${safeContext}"
                        onclick="event.stopPropagation(); window.DokkanAnimation.open('${safeScript}', '${safeLabel}', '${safeContext}')">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5.7v12.6c0 .9 1 1.4 1.8.9l9.4-6.3c.7-.4.7-1.4 0-1.8L9.8 4.8C9 4.3 8 4.8 8 5.7Z"></path>
                    </svg>
                    ${buttonText ? `<span class="abs-animation-btn-text">${buttonText}</span>` : ''}
                </button>
                ${canHaveKo ? `
                <button type="button"
                        class="abs-animation-play-btn abs-animation-ko-launch abs-animation-play-btn--with-text"
                        title="Play KO Screen: ${safeScript}"
                        aria-label="Play KO Screen"
                        data-ko-script="${safeScript}"
                        data-animation-context="${safeContext}"
                        hidden
                        onclick="event.stopPropagation(); window.DokkanAnimation.openKo('${safeScript}', '${safeContext}')">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5.7v12.6c0 .9 1 1.4 1.8.9l9.4-6.3c.7-.4.7-1.4 0-1.8L9.8 4.8C9 4.3 8 4.8 8 5.7Z"></path>
                    </svg>
                    <span class="abs-animation-btn-text">PLAY KO</span>
                </button>` : ''}
            </span>
        `;
    }

    // Some Lua files (including active-skill files) use a KO effect only when
    // `_IS_DEAD_LAST_` is true.  The old server-side index can still return a
    // payload where that effect is not flagged, so derive the flag from the
    // source as a compatibility fallback.  This keeps the card filter and the
    // per-skill controls in agreement even when an older animation server is
    // still running.
    function hasKoMarker(value) {
        const text = String(value || '').replace(/[‐‑‒–—]/g, '-');
        return /(?:^|[^A-Za-z0-9])K\s*[._-]?\s*O\.?\s*(?:$|[^A-Za-z0-9])|Ｋ\s*[．._-]?\s*[ＯO]|KOScreen|K\.O\.演出|KO演出/iu.test(text);
    }

    function getCallLineContext(source, index, length) {
      const text = String(source || '');
      const lineStart = text.lastIndexOf('\n', index - 1) + 1;
      const lineEnd = text.indexOf('\n', index + length);
      const end = lineEnd >= 0 ? lineEnd : text.length;
      const line = text.slice(lineStart, end);
      const offset = Math.max(0, index - lineStart);
      const prefix = line.slice(0, offset);
      const trailing = line.slice(offset + length);
      const assignment = prefix.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*$/);
      const previousLines = text.slice(0, lineStart).split(/\r?\n/);
      let previousComment = '';
      while (previousLines.length) {
        const candidate = String(previousLines.pop() || '').trim();
        if (!candidate) continue;
        previousComment = candidate;
        break;
      }
      return {
        callVariable: assignment?.[1] || '',
        trailingComment: trailing,
        previousComment: previousComment.startsWith('--') ? previousComment : '',
      };
    }
    

    function buildLuaNumberResolver(source) {
        const expressions = new Map();
        const assignmentPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;\r\n]+)\s*;?/gm;
        for (const match of String(source || '').matchAll(assignmentPattern)) {
            expressions.set(match[1], String(match[2] || '').replace(/--.*$/, '').trim());
        }

        const resolving = new Set();
        const cache = new Map();
        const resolve = (expression) => {
            let value = String(expression || '').replace(/--.*$/, '').trim();
            if (!value) return null;
            value = value.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (token, name) => {
                if (!expressions.has(name) || resolving.has(name)) return token;
                if (!cache.has(name)) {
                    resolving.add(name);
                    cache.set(name, resolve(expressions.get(name)));
                    resolving.delete(name);
                }
                const resolved = cache.get(name);
                return Number.isFinite(resolved) ? `(${resolved})` : token;
            });
            // Only evaluate a fully reduced arithmetic expression; no Lua text
            // or identifiers can reach this point.
            if (!/^[\d\s+\-*/().]+$/.test(value)) return null;
            try {
                const numeric = Function(`\"use strict\"; return (${value});`)();
                return Number.isFinite(numeric) ? Math.max(0, Number(numeric)) : null;
            } catch {
                return null;
            }
        };
        return resolve;
    }

    function getLuaFrameBase(expression) {
        return String(expression || '').replace(/--.*$/, '').trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\b/)?.[1] || '';
    }

    function resolveLuaFrameRelativeTo(expression, baseName, resolveFrame) {
        const base = String(baseName || '');
        if (!base) return null;
        const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matcher = new RegExp(`\\b${escapedBase}\\b`, 'g');
        const text = String(expression || '');
        if (!matcher.test(text)) return null;
        return resolveFrame(text.replace(new RegExp(`\\b${escapedBase}\\b`, 'g'), '0'));
    }

    function inferFinalAttackStartFrame(source, baseName, damageFrame, resolveFrame) {
        const base = String(baseName || '');
        if (!base || !Number.isFinite(damageFrame)) return null;

        // Sound cues are authored at the start of the visible move and remain
        // available even when the visual is split between an LWF and a USM.
        // Keep the nearest semantic attack marker instead of starting at the
        // later damage-label frame (which otherwise opens a KO preview halfway
        // through the last strike).
        const attackMarker = /(?:\bpunch\b|\bstrike\b|\battack\b|\bblast\b|\bbeam\b|\bslash\b|\bslam\b|\bimpact\b|\bfinish\b|\blast\b|\bfinal\b|パンチ|発射|ラスト|最後|必殺|突進|斬|蹴り|キック|殴り|叩きつけ|攻撃|連続気弾)/iu;
        const events = [];
        let marker = '';
        for (const line of String(source || '').split(/\r?\n/)) {
            if (!line.trim()) {
                marker = '';
                continue;
            }
            const leadingComment = line.match(/^\s*--\s*(.*)$/);
            if (leadingComment) {
                marker = String(leadingComment[1] || '').replace(/^\*+|\*+$/g, '').trim();
                continue;
            }
            const callPattern = /\b(?:playSeVer2|playSe|playVoice)\s*\(([^)]*)\)/g;
            for (const match of line.matchAll(callPattern)) {
                const expression = String(match[1] || '').split(',')[0].trim();
                if (!expression) continue;
                const callBase = getLuaFrameBase(expression);
                if (callBase !== base) continue;
                const frame = resolveLuaFrameRelativeTo(expression, base, resolveFrame);
                if (!Number.isFinite(frame) || frame > damageFrame + 1) continue;
                events.push({ frame, marker });
            }
        }

        const marked = events
            .filter((event) => attackMarker.test(event.marker))
            .map((event) => event.frame);
        if (marked.length) return Math.max(...marked);
        return null;
    }

    function inferKoEffectMetadata(payloadOrSource) {
      const source = typeof payloadOrSource === 'string'
        ? payloadOrSource
        : String(payloadOrSource?.lua_source || '');
      if (!source) return new Map();
    
      const assignments = new Map();
      const assignmentPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)\s*;?\s*([^\r\n]*)\r?$/gm;
      for (const match of source.matchAll(assignmentPattern)) {
        assignments.set(match[1], {
          id: Number(match[2]),
          isKo: hasKoMarker(match[1]) || hasKoMarker(match[3]),
          isFullTimelineKo: /(?:start|beginning|開始|スタート)[\s\S]{0,48}(?:K\s*[._-]?\s*O|Ｋ\s*[．._-]?\s*[ＯO])/iu.test(match[3]),
        });
      }
    
      const resolveFrame = buildLuaNumberResolver(source);
      const damageFrames = [], endFrames = [];
      const timingCallPattern = /\b(dealDamage|endPhase)\s*\(([^)]*)\)/g;
      for (const match of source.matchAll(timingCallPattern)) {
        const frame = resolveFrame(match[2].split(',')[0]);
        if (!Number.isFinite(frame)) continue;
        (match[1] === 'dealDamage' ? damageFrames : endFrames).push(frame);
      }
      const damageFrame = damageFrames.length ? Math.max(...damageFrames) : null;
      const endFrame = endFrames.length ? Math.max(...endFrames) : null;
      const tailStartRatio = Number.isFinite(damageFrame) && Number.isFinite(endFrame) && endFrame > damageFrame
        ? Math.min(0.985, Math.max(0.5, damageFrame / endFrame)) : 0;
    
      const timingByBase = new Map();
      for (const match of source.matchAll(timingCallPattern)) {
        const expression = match[2].split(',')[0];
        const base = getLuaFrameBase(expression);
        const relativeFrame = resolveLuaFrameRelativeTo(expression, base, resolveFrame);
        if (!base || !Number.isFinite(relativeFrame)) continue;
        const timing = timingByBase.get(base) || { damage: [], end: [] };
        (match[1] === 'dealDamage' ? timing.damage : timing.end).push(relativeFrame);
        timingByBase.set(base, timing);
      }
    
      const metadata = new Map();
      const effectCallPattern = /\b(setupMovie|entryEffect(?:Life|Unpausable|Attach|Sub)?)\s*\(([^)]*)\)/g;
      const calls = [];
      for (const match of source.matchAll(effectCallPattern)) {
        const tokens = match[2].split(',').map((part) => part.trim());
        const token = tokens[1];
        const assignment = assignments.get(token);
        const effectId = /^\d+$/.test(token || '') ? Number(token) : assignment?.id;
        if (!effectId) continue;
        const context = getCallLineContext(source, match.index, match[0].length);
        const explicitKo = Boolean(
          assignment?.isKo
          || hasKoMarker(token)
          || hasKoMarker(context.callVariable)
          || hasKoMarker(context.trailingComment)
          || hasKoMarker(context.previousComment)
        );
        const frameBase = getLuaFrameBase(tokens[0]);
        const entryFrameRelative = resolveLuaFrameRelativeTo(tokens[0], frameBase, resolveFrame);
        const entryFrameAbsolute = resolveFrame(tokens[0]);
        calls.push({
          match,
          tokens,
          assignment,
          effectId,
          method: match[1],
          explicitKo,
          frameBase,
          entryFrameRelative,
          entryFrameAbsolute,
        });
      }
      const visualEffectIds = new Set(calls.filter((call) => call.method !== 'setupMovie').map((call) => call.effectId));
      const koCalls = calls.filter((call) => call.explicitKo && call.method !== 'setupMovie');
      for (const call of calls) {
        // setupMovie is a skip/preload instruction for the same pack. When the
        // script also has a visual entryEffect for that id, let the visual call
        // provide the KO metadata so a nearby skip cue cannot turn a cut-in into
        // a KO layer. Keep setupMovie-only KO packs eligible for movie playback.
        if (call.method === 'setupMovie' && visualEffectIds.has(call.effectId)) continue;
        // A KO block often has a foreground and a background LWF mounted on the
        // same authored frame. Include those companions, but do not use a wide
        // character window that can accidentally tag an earlier cut-in or dodge
        // effect as KO.
        const sameAuthoredStart = koCalls.some((koCall) => {
          const sameBase = call.frameBase && koCall.frameBase && call.frameBase === koCall.frameBase;
          const sameRelative = Number.isFinite(call.entryFrameRelative)
            && Number.isFinite(koCall.entryFrameRelative)
            && Math.abs(call.entryFrameRelative - koCall.entryFrameRelative) <= 2;
          const sameAbsolute = Number.isFinite(call.entryFrameAbsolute)
            && Number.isFinite(koCall.entryFrameAbsolute)
            && Math.abs(call.entryFrameAbsolute - koCall.entryFrameAbsolute) <= 2;
          return call.method !== 'setupMovie'
            && koCall.method !== 'setupMovie'
            && call !== koCall
            && ((sameBase && sameRelative) || sameAbsolute);
        });
        if (!call.explicitKo && !sameAuthoredStart) continue;
    
        const { match, tokens, assignment, effectId, frameBase, entryFrameRelative, entryFrameAbsolute } = call;
    
        const prior = metadata.get(effectId) || {
          id: effectId, isFullTimelineKo: false, isStandaloneKoScene: false,
          koStartRatio: 0, koStartFrame: 0, koDamageFrame: 0, koEndFrame: 0,
          needsBattleResult: false,
        };
        const isMountedAtPhaseStart = Boolean(
          Number.isFinite(entryFrameRelative) && entryFrameRelative <= 1
          && (!Number.isFinite(entryFrameAbsolute) || entryFrameAbsolute <= 1),
        );
        const localTiming = timingByBase.get(frameBase);
        const localDamage = localTiming?.damage?.length ? Math.max(...localTiming.damage) : null;
        const localEnd = localTiming?.end?.length ? Math.max(...localTiming.end) : null;
        const localAttackStart = inferFinalAttackStartFrame(source, frameBase, localDamage, resolveFrame);
        const localTailStartFrame = Number.isFinite(localAttackStart) ? localAttackStart : localDamage;
        const localTailStartRatio = Number.isFinite(localTailStartFrame) && Number.isFinite(localEnd) && localEnd > localTailStartFrame
          ? Math.min(0.985, Math.max(0.5, localTailStartFrame / localEnd)) : 0;
        const effectTailStartRatio = localTailStartRatio || tailStartRatio;
        const effectTailStartFrame = Number.isFinite(localTailStartFrame) ? localTailStartFrame : (Number.isFinite(damageFrame) ? damageFrame : 0);
        const hasLocalKoTail = Boolean(isMountedAtPhaseStart && Number.isFinite(localDamage) && Number.isFinite(localEnd)
          && localDamage >= 30 && localEnd > localDamage && localTailStartRatio >= 0.5);
        const needsBattleResult = Boolean(isMountedAtPhaseStart && Number.isFinite(localDamage)
          && Number.isFinite(localEnd) && localEnd > localDamage);
        const isFullTimelineKo = Boolean(assignment?.isFullTimelineKo || (isMountedAtPhaseStart && effectTailStartRatio > 0) || hasLocalKoTail);
        metadata.set(effectId, {
          ...prior,
          isFullTimelineKo: prior.isFullTimelineKo || isFullTimelineKo,
          isStandaloneKoScene: prior.isStandaloneKoScene || !isMountedAtPhaseStart,
          koStartRatio: isFullTimelineKo ? Math.max(prior.koStartRatio || 0, effectTailStartRatio) : prior.koStartRatio,
          koStartFrame: isFullTimelineKo ? Math.max(prior.koStartFrame || 0, effectTailStartFrame || 0) : prior.koStartFrame,
          koDamageFrame: Number.isFinite(localDamage) ? Math.max(prior.koDamageFrame || 0, localDamage) : prior.koDamageFrame,
          needsBattleResult: prior.needsBattleResult || needsBattleResult,
          koEndFrame: isFullTimelineKo && Number.isFinite(localEnd) ? Math.max(prior.koEndFrame || 0, localEnd) : prior.koEndFrame,
        });
      }
      return metadata;
    }
    
    function inferKoEffectIds(payload) {
        return new Set(inferKoEffectMetadata(payload).keys());
    }

    function inferReferencedEffectIds(payload) {
        const source = String(payload?.lua_source || '');
        if (!source) return new Set();

        const assignments = new Map();
        const assignmentPattern = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(\d+)\s*;?/gm;
        for (const match of source.matchAll(assignmentPattern)) {
            assignments.set(match[1], Number(match[2]));
        }

        const ids = new Set();
        // ActionBank uses these calls for every mounted LWF scene.  The API's
        // initial list can omit a secondary pack (notably sp3013's final
        // punch), so derive the complete list directly from the authored Lua.
        const effectCallPattern = /\b(setupMovie|entryEffect(?:Life|Unpausable|Attach|Sub)?)\s*\(([^)]*)\)/g;
        for (const match of source.matchAll(effectCallPattern)) {
            const token = String(match[2].split(',')[1] || '').trim();
            const id = /^\d+$/.test(token) ? Number(token) : assignments.get(token);
            if (Number.isFinite(id) && id > 0) ids.add(id);
        }
        return ids;
    }

    function annotateKoEffects(payload) {
        if (!payload || !Array.isArray(payload.effects)) return payload;
        const inferred = inferKoEffectMetadata(payload);
        payload.effects.forEach((effect) => {
            const metadata = inferred.get(Number(effect?.id));
            const effectLabel = [
                effect?.scene_name,
                ...(Array.isArray(effect?.source_names) ? effect.source_names : []),
                effect?.name,
            ].filter(Boolean).join(' ');
            if (!metadata) {
                // Older animation-server payloads can carry the KO label on
                // the effect row without the Lua-derived metadata. Preserve
                // that authoritative row-level signal as a fallback.
                if (hasKoMarker(effectLabel)) effect.ko_screen = true;
                return;
            }
            effect.ko_screen = true;
            if (metadata.koStartRatio > 0) effect.ko_start_ratio = metadata.koStartRatio;
            if (metadata.koStartFrame > 0) effect.ko_start_frame = metadata.koStartFrame;
            if (metadata.koDamageFrame > 0) effect.ko_damage_frame = metadata.koDamageFrame;
            if (metadata.koEndFrame > 0) effect.ko_end_frame = metadata.koEndFrame;
            if (metadata.needsBattleResult) effect.ko_runtime_result = true;
            if (metadata.isStandaloneKoScene) effect.ko_standalone_scene = true;
        });
        return payload;
    }

    async function hydrateReferencedEffects(payload) {
        // Some animation-server builds cache only the first effect pack.  A
        // later phase can therefore be absent even though the Lua asks for it
        // (for example sp3013's lightning punch, or a separate KO layer).
        // Treat the authored Lua as the source of truth and fetch every
        // referenced pack that the response did not already include.
        if (!payload || !Array.isArray(payload.effects)) return payload;
        annotateKoEffects(payload);
        const referencedIds = [...inferReferencedEffectIds(payload)];
        const presentIds = new Set(payload.effects.map((effect) => Number(effect?.id)));
        const missingIds = referencedIds.filter((id) => id > 0 && !presentIds.has(id));
        if (!missingIds.length) return payload;

        const results = await Promise.allSettled(missingIds.map(async (id) => {
            const response = await fetchFromAnimationBridge(`/api/effect/${encodeURIComponent(String(id))}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(String(response.status));
            return { id, effect: await response.json() };
        }));

        results.forEach((result) => {
            if (result.status !== 'fulfilled' || !result.value?.effect) return;
            const effect = result.value.effect;
            // The direct endpoint does not know how a script uses this pack.
            // annotateKoEffects below restores KO-only metadata from Lua.
            effect.ko_screen = Boolean(effect.ko_screen);
            effect.source_names = Array.isArray(effect.source_names) ? effect.source_names : [];
            effect.primary = false;
            payload.effects.push(effect);
        });
        annotateKoEffects(payload);
        return payload;
    }

    // Kept as a compatibility name for code that only wants to discover the
    // KO button; it now performs the more complete Lua hydration above.
    const hydrateReferencedKoEffects = hydrateReferencedEffects;

    function hasAvailableKoFiles(effect) {
        const hasLwfFiles = Array.isArray(effect?.files) && effect.files.length > 0;
        const hasConfirmedMovie = Boolean(
            effect?.movie_url
            && effect?.has_movie !== false,
        );
        return Boolean(
            effect
            && effect.ko_screen
            && effect.available !== false
            && (hasLwfFiles || hasConfirmedMovie),
        );
    }

    function getKoEffects(payload) {
        annotateKoEffects(payload);
        return (Array.isArray(payload?.effects) ? payload.effects : []).filter(hasAvailableKoFiles);
    }

    function getEffectLayerRank(effect) {
        const label = [
            effect?.scene_name,
            ...(Array.isArray(effect?.source_names) ? effect.source_names : []),
            effect?.name,
        ].filter(Boolean).join(' ').toLowerCase();
        // Dokkan commonly calls a background counterpart ef_003b / SP_003b.
        // It must be appended first so the normal ef_003 foreground remains
        // visible above it.  Treat explicit foreground names the same way.
        if (/(?:^|[\s_-])(?:b|bg|back|background)(?:$|[\s_-])/i.test(label) || /(?:^|[\s_-])\w+b(?:$|[\s_-])/i.test(label)) return -1;
        if (/(?:^|[\s_-])(?:f|fg|front|foreground)(?:$|[\s_-])/i.test(label)) return 1;
        return 0;
    }

    function orderEffectLayers(effects) {
        return [...(effects || [])]
            .map((effect, index) => ({ effect, index }))
            .sort((left, right) => getEffectLayerRank(left.effect) - getEffectLayerRank(right.effect) || left.index - right.index)
            .map(({ effect }) => effect);
    }

    function revealKoLaunchButtons(scriptName, payload) {
        const script = normalizeScriptKey(scriptName);
        const hasKo = getKoEffects(payload).length > 0;
        koAvailability.set(script, hasKo);
        document.querySelectorAll('.abs-animation-ko-launch').forEach((button) => {
            if (normalizeScriptKey(button.dataset.koScript) !== script) return;
            button.hidden = !hasKo;
        });
        return hasKo;
    }

    let koScreenIndexPromise = null;
    function getKoScreenIndex() {
        if (!koScreenIndexPromise) {
            koScreenIndexPromise = fetch('json/ko_screen_index.json')
                .then((r) => (r.ok ? r.json() : null))
                .then((data) => {
                    return new Set((data?.scripts || []).map((s) => normalizeScriptKey(s)));
                })
                .catch(() => new Set());
        }
        return koScreenIndexPromise;
    }

    async function hydrateKoLaunchButton(button) {
        const scriptName = String(button?.dataset?.koScript || '').trim();
        const script = normalizeScriptKey(scriptName);
        if (!SCRIPT_NAME_PATTERN.test(scriptName) || button.dataset.koChecked === '1') return;
        button.dataset.koChecked = '1';
        if (koAvailability.has(script)) {
            button.hidden = !koAvailability.get(script);
            return;
        }

        const knownKoScripts = await getKoScreenIndex();
        if (knownKoScripts && knownKoScripts.size > 0) {
            const hasKo = knownKoScripts.has(script);
            koAvailability.set(script, hasKo);
            button.hidden = !hasKo;
            if (hasKo) return;
        }

        try {
            const response = await fetchFromAnimationBridge(`/api/animation/${encodeURIComponent(scriptName)}`, { cache: 'no-store' });
            if (!response.ok) throw new Error(String(response.status));
            const payload = await response.json();
            await hydrateReferencedKoEffects(payload);
            revealKoLaunchButtons(scriptName, payload);
        } catch {
            // If the local bridge is not running, rely on verified static index
            if (!koAvailability.has(script)) {
                koAvailability.set(script, false);
                button.hidden = true;
            }
        }
    }

    function hydrateKoLaunchButtons(root = document) {
        if (root?.matches?.('.abs-animation-ko-launch')) hydrateKoLaunchButton(root);
        root?.querySelectorAll?.('.abs-animation-ko-launch').forEach(hydrateKoLaunchButton);
    }

    function updateSequenceControls() {
        const overlay = document.getElementById('abs-animation-modal');
        if (!overlay) return;
        const toggleButton = overlay.querySelector('[data-animation-action="toggle-play"]');
        if (!toggleButton) return;
        const isSequence = activeMode === 'sequence' && actionBankRunner;
        const hasEffectPlayer = !isSequence && activePlayers.length > 0;
        const isPaused = isSequence
            ? Boolean(actionBankRunner?.userPaused)
            : hasEffectPlayer && activePlayers.every((player) => !player.playing);
        const isPlaying = isSequence
            ? Boolean(actionBankRunner?.playing)
            : hasEffectPlayer && activePlayers.some((player) => player.playing);
        toggleButton.disabled = isSequence
            ? !actionBankRunner?.ready
            : !hasEffectPlayer;
        toggleButton.textContent = (isPlaying && !isPaused) ? 'Pause' : 'Play';
    }

    async function getRunner() {
        if (!actionBankRunner) {
            const { ActionBankRunner } = await import('./action-bank-runner.js?v=20260905-responsive-stage-v4');
            const stack = document.getElementById('abs-animation-stage-stack');
            actionBankRunner = new ActionBankRunner({
                stageStack: stack,
                serverUrl: getServerUrl(),
                log: (msg) => console.log(`[DokkanActionBank] ${msg}`),
                onStatus: (kind, r) => {
                    const status = document.getElementById('abs-animation-status');
                    if (!status) return;
                    if (kind === 'playing') {
                        status.textContent = `Playing frame ${r.frame} / ${r.maxFrame}`;
                        status.hidden = false;
                    } else if (kind === 'paused') {
                        status.textContent = `Paused at frame ${r.frame} / ${r.maxFrame}`;
                        status.hidden = false;
                    } else if (kind === 'done') {
                        status.textContent = `Sequence complete (${r.maxFrame} frames)`;
                        status.hidden = false;
                    } else if (kind === 'stopped') {
                        status.textContent = 'Stopped';
                    }
                    updateSequenceControls();
                },
                onFrame: (frame, maxFrame) => {
                    const status = document.getElementById('abs-animation-status');
                    if (status && actionBankRunner.playing) {
                        status.textContent = `Frame ${frame} / ${maxFrame}`;
                    }
                },
                onDone: () => {
                    console.log('ActionBank sequence finished');
                }
            });
        }
        actionBankRunner.setServerUrl(getServerUrl());
        return actionBankRunner;
    }

    
    function formatAnimationTitle(label, animationContext, requestedMode) {
        if (requestedMode === 'ko') return 'KO SCREEN';
        if (animationContext === 'active') return 'ACTIVE SKILL';
        if (animationContext === 'passive') return 'INTRO ANIMATION';
        if (animationContext === 'counter' || animationContext === 'nullification') return 'COUNTER ANIMATION';
        if (animationContext === 'standby') return 'STANDBY SKILL';
        if (animationContext === 'finish') return 'FINISH SKILL';
        if (animationContext === 'sa1' || animationContext === 'sa2') return 'SUPER ATTACK';
        const clean = String(label || 'ACTIVE SKILL').replace(/^Play\s+/i, '').trim();
        return clean ? clean.toUpperCase() : 'ACTIVE SKILL';
    }

    function ensureModal() {
        let overlay = document.getElementById('abs-animation-modal');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'abs-animation-modal';
        overlay.className = 'abs-animation-modal';
        overlay.hidden = true;
        overlay.innerHTML = `
            <div class="abs-animation-dialog" role="dialog" aria-modal="true" aria-labelledby="abs-animation-title">
                <div class="abs-animation-modal-header">
                    <span id="abs-animation-title" class="abs-animation-title">ACTIVE SKILL</span>
                    <div id="abs-animation-script" class="abs-animation-script" style="display: none;"></div>
                    <button type="button" class="abs-animation-close" aria-label="Close animation preview" title="Close">&times;</button>
                </div>
                <div class="abs-animation-body">
                    <div class="abs-animation-stage-wrap">
                        <div id="abs-animation-stage-stack" class="abs-animation-stage-stack">
                            <canvas id="abs-animation-canvas" class="abs-animation-layer-canvas" width="852" height="1536"></canvas>
                        </div>
                        <div id="abs-animation-status" class="abs-animation-status">Loading local animation…</div>
                    </div>
                    <div class="abs-animation-sidebar" style="display: none !important;">
                        <div id="abs-animation-effects" class="abs-animation-effects"></div>
                        <input type="number" id="abs-animation-attacker-id" value="" />
                        <input type="number" id="abs-animation-enemy-id" value="1000020" />
                        <input type="number" id="abs-animation-bg-id" value="1" />
                    </div>
                </div>
                <div class="abs-animation-controls">
                    <button type="button" data-animation-action="speed" style="min-width: 50px;">1x</button>
                    <button type="button" data-animation-action="toggle-play">Pause</button>
                    <button type="button" data-animation-action="restart">Reset</button>
                    <label class="abs-animation-volume" title="Animation sound-effect volume">
                        <span>Volume</span>
                        <input type="range" min="0" max="100" step="1" value="${Math.round(masterVolume * 100)}" data-animation-action="volume" />
                        <output data-animation-volume-label>${Math.round(masterVolume * 100)}%</output>
                    </label>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay || event.target.closest('.abs-animation-close')) close();
        });
        overlay.querySelector('[data-animation-action="restart"]').addEventListener('click', restart);
        function togglePlayPause() {
            const isSequence = activeMode === 'sequence' && actionBankRunner;
            const hasEffectPlayer = !isSequence && activePlayers.length > 0;
            const isPaused = isSequence
                ? Boolean(actionBankRunner?.userPaused)
                : hasEffectPlayer && activePlayers.every((player) => !player.playing);
            if (isPaused) {
                if (isSequence) {
                    actionBankRunner.play();
                } else {
                    activePlayers.forEach((player) => player.play());
                }
            } else {
                if (isSequence) {
                    actionBankRunner.pause();
                } else {
                    activePlayers.forEach((player) => player.pause());
                }
            }
            updateSequenceControls();
        }

        const togglePlayBtn = overlay.querySelector('[data-animation-action="toggle-play"]');
        if (togglePlayBtn) {
            togglePlayBtn.addEventListener('click', togglePlayPause);
        }
        overlay.querySelector('[data-animation-action="speed"]').addEventListener('click', (e) => {
            is2xSpeed = !is2xSpeed;
            e.target.textContent = is2xSpeed ? '2x' : '1x';
            if (actionBankRunner) actionBankRunner.setHighSpeed(is2xSpeed);
        });
        overlay.querySelector('[data-animation-action="volume"]').addEventListener('input', (event) => {
            masterVolume = Math.max(0, Math.min(1, Number(event.target.value) / 100));
            localStorage.setItem('dokkan-animation-volume', String(masterVolume));
            const label = overlay.querySelector('[data-animation-volume-label]');
            if (label) label.textContent = `${Math.round(masterVolume * 100)}%`;
            actionBankRunner?.setMasterVolume(masterVolume);
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !overlay.hidden) close();
            if ((event.code === 'Space' || event.key === ' ') && !overlay.hidden) {
                if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)) return;
                event.preventDefault();
                togglePlayPause();
            }
        });
        return overlay;
    }

    function setStatus(message, isError = false) {
        const status = document.getElementById('abs-animation-status');
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('is-error', isError);
        status.hidden = !message;
    }

    async function getPlayerModule() {
        if (!playerModulePromise) playerModulePromise = import('../js-graphics/lwf-pack.js?v=20260905-canvas-blend-fix-v1');
        return playerModulePromise;
    }

    async function getUsmModule() {
        if (!usmModulePromise) usmModulePromise = import('./usm/pipeline.js');
        return usmModulePromise;
    }

    function resetStage() {
        const stack = document.getElementById('abs-animation-stage-stack');
        if (!stack) return null;
        const { width, height } = getAnimationViewportDimensions();
        stack.innerHTML = `<canvas id="abs-animation-canvas" class="abs-animation-layer-canvas" width="${width}" height="${height}"></canvas>`;
        return stack;
    }

    function destroyPlayers() {
        if (actionBankRunner) {
            try { actionBankRunner.stop(); } catch {}
        }
        activePlayers.forEach((player) => {
            try { player.clear(); } catch (error) {}
        });
        activePlayers = [];
        activeEffect = null;
        activeEffectOptions = null;
    }

    async function fetchPackFiles(effect) {
        const files = await Promise.all(effect.files.map(async (file) => {
            const response = await fetch(file.url);
            if (!response.ok) throw new Error(`Missing local asset: ${file.name}`);
            return new File([await response.blob()], file.name);
        }));
        return files;
    }

    async function fetchEffectPayload(effectId) {
        try {
            const response = await fetchFromAnimationBridge(`/api/effect/${encodeURIComponent(String(effectId))}`, { cache: 'no-store' });
            if (!response.ok) return null;
            const effect = await response.json().catch(() => null);
            return effect?.available && Array.isArray(effect.files) && effect.files.length ? effect : null;
        } catch {
            return null;
        }
    }

    async function createEffectPlayer(effect, canvas, {
        loopMovie,
        loopStartFrame = 0,
        loopEndFrame = 0,
        loopTailFrames = 0,
        koStartRatio = 0,
        koStartFrame = 0,
        koEndFrame = 0,
        freezeOnStaticTail = false,
        staticTailMinFrames = 18,
        waitForNestedMoviesAtEnd = true,
    } = {}) {
        const [{ LwfPackPlayer }, files] = await Promise.all([getPlayerModule(), fetchPackFiles(effect)]);
        const player = new LwfPackPlayer(canvas, () => {});
        // Most individual effect previews retain their authored ending. Callers
        // such as the KO viewer can opt into a complete, bounded LWF loop.
        player.loopMovie = typeof loopMovie === 'boolean' ? loopMovie : loopTailFrames > 0;
        player.loopStartFrame = Math.max(0, Number(loopStartFrame) || 0);
        player.loopEndFrame = Math.max(0, Number(loopEndFrame) || 0);
        player.loopTailFrames = Math.max(0, Number(loopTailFrames) || 0);
        player.freezeOnStaticTail = Boolean(freezeOnStaticTail);
        player.staticTailMinFrames = Math.max(1, Number(staticTailMinFrames) || 18);
        player.waitForNestedMoviesAtEnd = waitForNestedMoviesAtEnd !== false;
        player.onEnded = () => updateSequenceControls();
        const ingested = player.ingestFiles(files);
        if (!ingested.lwfFile) throw new Error(`No LWF file was found in ${effect.pack_name}.`);
        const prepared = await player.prepare(ingested.lwfFile);
        if (prepared.missing?.length) throw new Error(`Missing textures: ${prepared.missing.join(', ')}`);
        const movies = await player.load();
        // Preserve the LWF's authored ratio, but scale it to cover the selected
        // Dokkan viewport. Any mismatch is intentionally cropped, never padded
        // by black letterbox bars.
        const nativeWidth = Number(prepared.header?.width) || 852;
        const nativeHeight = Number(prepared.header?.height) || 1536;
        const viewport = getAnimationViewportDimensions();
        const coverScale = Math.max(viewport.width / nativeWidth, viewport.height / nativeHeight);
        canvas.style.inset = 'auto';
        canvas.style.left = '50%';
        canvas.style.top = '50%';
        canvas.style.width = `${(nativeWidth * coverScale / viewport.width) * 100}%`;
        canvas.style.height = `${(nativeHeight * coverScale / viewport.height) * 100}%`;
        canvas.style.maxWidth = 'none';
        canvas.style.maxHeight = 'none';
        canvas.style.transform = 'translate(-50%, -50%)';
        canvas.style.transformOrigin = 'center center';
        const scene = movies.includes(effect.scene_name) ? effect.scene_name : movies[0];
        // Keep the scene paused while KO setup determines its initial frame.
        // Starting it first and then seeking can desynchronise nested LWF
        // movies, particularly the full-length Gamma/Gohan KO sequence.
        if (!scene || !player.setMovie(scene, { play: false })) {
            throw new Error(`Scene ${effect.scene_name || '(unknown)'} was not found in the LWF.`);
        }
        const authoredKoStartFrame = Math.max(0, Math.floor(Number(koStartFrame) || 0));
        const authoredKoEndFrame = Math.max(0, Math.floor(Number(koEndFrame) || 0));
        const hasAuthoredKoRange = authoredKoEndFrame > authoredKoStartFrame + 10;
        // Resolve the local scene span before applying Lua phase frame
        // numbers.  A script's `spep_2 + 726` is often a global ActionBank
        // frame while the linked LWF is a shorter local scene (Piccolo's
        // 838-frame phase is a 474-frame LWF).  Treating the global number as
        // a local seek jumps past the scene and renders a blank canvas.
        const sceneFrames = typeof player.getMovieFrameCount === 'function'
            ? player.getMovieFrameCount()
            : Number(player.movie?.totalFrames) || 0;
        const authoredRangeFitsScene = hasAuthoredKoRange
            && (!sceneFrames || authoredKoEndFrame <= sceneFrames);
        // Lua's local phase bounds match the corresponding LWF's timeline in
        // the rare cases where the authored values fit.  Otherwise use the
        // actual LWF span and let the ratio below map the phase timing into
        // that shorter scene.
        if (player.loopMovie && player.loopEndFrame <= 0 && authoredRangeFitsScene) {
            player.loopEndFrame = authoredKoEndFrame;
        }
        // KO packs commonly use a short root scene with the visible animation
        // in nested movies. Use the full active scene span so every frame of
        // the KO LWF loops, rather than restarting after the root container's
        // shorter timeline. Explicit bounds still win when a caller supplies
        // them.
        if (player.loopMovie && player.loopEndFrame <= 0) {
            if (sceneFrames > 1) {
                player.loopEndFrame = sceneFrames;
                if (player.freezeOnStaticTail) {
                    // Short transition clips may not have an 18-frame hold;
                    // scale the detector window to the available scene span.
                    player.staticTailMinFrames = Math.max(
                        4,
                        Math.min(player.staticTailMinFrames, Math.floor(sceneFrames * 0.35)),
                    );
                }
            }
        }
        // Some cards package the whole attack and its KO result in one LWF
        // (usually labelled "start → KO" in their Lua).  Their KO preview must
        // begin at the damage/KO point rather than replaying the opening.
        const startRatio = Math.min(0.985, Math.max(0, Number(koStartRatio) || 0));
        const directKoStartFrame = authoredRangeFitsScene
            && authoredKoStartFrame > 0
            && authoredKoStartFrame < player.loopEndFrame
            ? authoredKoStartFrame
            : 0;
        if (player.loopMovie && (directKoStartFrame > 0 || startRatio > 0) && player.loopEndFrame > 1) {
            const resolvedKoStartFrame = directKoStartFrame || Math.max(1, Math.floor(player.loopEndFrame * startRatio));
            player.loopStartFrame = Math.min(player.loopEndFrame, resolvedKoStartFrame);
            const advanced = typeof player.fastForwardToFrame === 'function'
                && player.fastForwardToFrame(player.loopStartFrame, { play: true });
            if (!advanced) player.seekFrame(player.loopStartFrame, { play: true });
        } else {
            player.play();
        }
        return player;
    }

    async function createKoMoviePlayer(effect, stack, {
        koStartRatio = 0,
        koStartFrame = 0,
        koEndFrame = 0,
    } = {}) {
        if (!effect?.movie_url || !stack) throw new Error('No authored KO movie is available.');

        const [{ openUsm }, response] = await Promise.all([
            getUsmModule(),
            fetch(effect.movie_url),
        ]);
        if (!response.ok) throw new Error(`Could not load KO movie (${response.status}).`);

        const result = await openUsm(await response.arrayBuffer());
        const video = document.createElement('video');
        video.className = 'abs-cutscene-video abs-ko-screen-movie';
        video.src = result.videoUrl;
        video.playsInline = true;
        video.muted = true;
        video.preload = 'auto';
        video.style.cssText = [
            'position:absolute',
            'inset:0',
            'display:block',
            'width:100%',
            'height:100%',
            'object-fit:cover',
            'pointer-events:none',
            'z-index:20',
            'background:transparent',
        ].join(';');
        stack.innerHTML = '';
        stack.appendChild(video);

        await new Promise((resolve, reject) => {
            const onReady = () => {
                video.removeEventListener('loadedmetadata', onReady);
                video.removeEventListener('error', onError);
                resolve();
            };
            const onError = () => {
                video.removeEventListener('loadedmetadata', onReady);
                video.removeEventListener('error', onError);
                reject(new Error('The KO movie could not be decoded by this browser.'));
            };
            video.addEventListener('loadedmetadata', onReady, { once: true });
            video.addEventListener('error', onError, { once: true });
        });

        const duration = Math.max(0, Number(video.duration) || Number(result.meta?.durationSec) || 0);
        const localStart = Math.max(0, Number(koStartFrame) || 0);
        const localEnd = Math.max(0, Number(koEndFrame) || 0);
        const authoredRatio = localEnd > localStart + 10 ? localStart / localEnd : 0;
        const startRatio = Math.min(0.985, Math.max(0, authoredRatio || Number(koStartRatio) || 0));
        const loopStart = duration > 0 ? Math.min(Math.max(0, duration - 1 / 30), duration * startRatio) : 0;
        const restartMovie = () => {
            if (duration > 0) video.currentTime = loopStart;
            video.play().catch(() => {});
        };
        const controller = {
            playing: false,
            pause() {
                video.pause();
                this.playing = false;
            },
            play() {
                video.play().catch(() => {});
                this.playing = true;
            },
            clear() {
                video.pause();
                video.removeAttribute('src');
                try { video.load(); } catch {}
                video.remove();
                try { URL.revokeObjectURL(result.videoUrl); } catch {}
                this.playing = false;
            },
        };
        video.addEventListener('play', () => {
            controller.playing = true;
            updateSequenceControls();
        });
        video.addEventListener('pause', () => {
            controller.playing = false;
            updateSequenceControls();
        });
        // A movie plate is an exact portrait render of the effect. Loop only
        // its final KO segment, never its opening setup, so a static final
        // card stays visible for its full authored hold instead of flashing.
        video.addEventListener('ended', restartMovie);
        if (duration > 0) video.currentTime = loopStart;
        restartMovie();
        return controller;
    }

    function markSelectedEffects(effectIds, mode = 'single') {
        document.querySelectorAll('.abs-animation-effect-btn').forEach((button) => {
            button.classList.toggle('active', effectIds.includes(button.dataset.effectId));
        });
        document.querySelector('.abs-animation-composite-btn')?.classList.toggle('active', mode === 'composite');
        document.querySelector('.abs-animation-sequence-btn')?.classList.toggle('active', mode === 'sequence');
        document.querySelector('.abs-animation-ko-btn')?.classList.toggle('active', mode === 'ko');
    }

    async function playSequence(payload = activePayload) {
        if (!payload?.lua_source) {
            setStatus('No Lua source code was returned for this animation.', true);
            return;
        }
        destroyPlayers();
        resetStage();
        activeMode = 'sequence';
        markSelectedEffects([], 'sequence');
        setStatus('Compiling Lua timeline & preloading effects…');

        try {
            const runner = await getRunner();
            runner.setPayload(payload);
            runner.setHighSpeed(is2xSpeed);
            runner.setMasterVolume(masterVolume);

            const attackerInput = document.getElementById('abs-animation-attacker-id');
            const enemyInput = document.getElementById('abs-animation-enemy-id');

            const backgroundInput = document.getElementById('abs-animation-bg-id');
            const attackerId = Number(attackerInput?.value) || getCurrentCardId();
            const enemyId = Number(enemyInput?.value) || 1000020;
            const backgroundId = Math.max(0, Number(backgroundInput?.value) || 1);

            if (attackerInput && !attackerInput.value) attackerInput.value = String(attackerId);
            if (enemyInput && !enemyInput.value) enemyInput.value = String(enemyId);

            const cmdCount = await runner.loadScript({
                luaSource: payload.lua_source,
                commonSource: payload.common_source,
                scriptName: payload.script_name,
                card: { id: attackerId },
                enemyId: enemyId,
                backgroundId,
                animationContext: activeAnimationContext,
            });
            setStatus(`Playing Lua sequence (${cmdCount} events, ${runner.maxFrame} frames)…`);
            runner.play();
            updateSequenceControls();
        } catch (error) {
            console.error('Dokkan Lua sequence playback failed:', error);
            setStatus(error.message || 'Lua sequence failed to execute.', true);
        }
    }

    async function playEffect(effect, options = {}) {
        if (!effect?.available || !Array.isArray(effect.files) || !effect.files.length) {
            setStatus(`The ${effect?.pack_name || 'selected'} LWF pack is not in the local asset folder.`, true);
            return;
        }
        destroyPlayers();
        resetStage();
        activeEffect = effect;
        activeEffectOptions = { ...options };
        activeMode = options.mode || 'single';
        markSelectedEffects([String(effect.id)], activeMode);
        setStatus(`Loading ${options.label || effect.pack_name}…`);
        try {
            const canvas = document.getElementById('abs-animation-canvas');
            activePlayers = [await createEffectPlayer(effect, canvas, options)];
            setStatus('');
            updateSequenceControls();
        } catch (error) {
            console.error('Dokkan local animation preview failed:', error);
            setStatus(error.message || 'The local LWF preview could not be loaded.', true);
        }
    }

    async function playKoScreen(payload = activePayload) {
        const koEffects = getKoEffects(payload);
        if (!koEffects.length) {
            setStatus('No separate KO-screen effect was detected in this animation.', true);
            return;
        }
        const hasStandaloneKoScenesOnly = koEffects.length > 0
            && koEffects.every((effect) => Boolean(effect?.ko_standalone_scene));
        const options = {
            mode: 'ko',
            label: 'KO screen',
            // A scene explicitly mounted late by `_IS_DEAD_LAST_` is an
            // authored result clip, not a looping attack. Let it play once
            // and hold its true last frame. Full attack LWFs continue to use
            // the bounded loop path below, which is necessary when their
            // ending remains animated.
            loopMovie: !hasStandaloneKoScenesOnly,
            loopStartFrame: 1,
            loopTailFrames: 0,
            freezeOnStaticTail: !hasStandaloneKoScenesOnly,
            staticTailMinFrames: 18,
            waitForNestedMoviesAtEnd: hasStandaloneKoScenesOnly,
        };
        // A KO pack may carry a USM scene plate as well as its LWF support
        // layer. The LWF alone often contains only sparks, impact lettering,
        // or a foreground overlay; the USM carries the actual full-screen KO
        // portrait. Prefer the plate, then fall back to LWF for older packs.
        // `movie_url` is always present in the animation-server payload as a
        // canonical candidate path, even when that USM was not pulled locally.
        // Only try the movie plate when the server confirmed the file exists;
        // otherwise go straight to the authored LWF layers.  This matters for
        // older attacks such as Piccolo's sp_effect_a9_00137, whose URL is
        // advertised but has_movie is false and would otherwise add a delayed
        // 404 before the real KO LWF can start at its inferred final attack.
        const movieKoEffect = koEffects.find((effect) =>
            effect?.movie_url
            && effect?.has_movie !== false
            // A pack-level USM can cover the attack's main scene rather than
            // its late-mounted `ef_002`/`ef_003` KO scene. The Lua explicitly
            // names that latter scene, so it is the authoritative asset for
            // a standalone KO preview.
            && !effect?.ko_standalone_scene
        );
        if (movieKoEffect) {
            destroyPlayers();
            const stack = resetStage();
            activeEffect = movieKoEffect;
            activeEffectOptions = { ...options, moviePlate: true };
            activeMode = 'ko';
            markSelectedEffects(koEffects.map((effect) => String(effect.id)), 'ko');
            setStatus(`Loading ${movieKoEffect.pack_name} KO movie…`);
            try {
                activePlayers = [await createKoMoviePlayer(movieKoEffect, stack, {
                    koStartRatio: Number(movieKoEffect.ko_start_ratio) || 0,
                    koStartFrame: Number(movieKoEffect.ko_start_frame) || 0,
                    koEndFrame: Number(movieKoEffect.ko_end_frame) || 0,
                })];
                setStatus('');
                updateSequenceControls();
                return;
            } catch (error) {
                // Not every legacy USM is browser-decodable. The LWF remains
                // a valid lower-fidelity fallback rather than hiding the KO
                // control altogether.
                console.warn('KO movie preview failed; using the LWF fallback:', error);
            }
        }
        // The game adds the shared battle-result layer when `dealDamage` fires;
        // it is not part of the character's KO LWF.  Use the real local
        // battle_170000 asset for dedicated LWF KO scenes and begin their
        // underlying attack layer at that authored damage frame.  This avoids
        // reopening Piccolo's scene at the earlier ki-blast launch cue (494),
        // which is why the old KO button looked like a mid-attack preview.
        const useBattleResultLayer = koEffects.some((effect) =>
            effect?.ko_runtime_result && Number(effect?.ko_damage_frame) > 0
        );
        const battleResultEffect = useBattleResultLayer ? await fetchEffectPayload(1700) : null;

        if (koEffects.length === 1 && !battleResultEffect) {
            const effect = koEffects[0];
            const canTrim = !effect?.ko_standalone_scene;
            const authoredDamageFrame = Number(effect.ko_damage_frame) || 0;
            const authoredEndFrame = Number(effect.ko_end_frame) || 0;
            const damageRatio = canTrim && authoredDamageFrame > 0 && authoredEndFrame > authoredDamageFrame
                ? Math.min(0.985, Math.max(0.5, authoredDamageFrame / authoredEndFrame))
                : 0;
            await playEffect(koEffects[0], {
                ...options,
                koStartRatio: canTrim ? damageRatio || Number(effect.ko_start_ratio) || 0 : 0,
                koStartFrame: canTrim
                    ? authoredDamageFrame || Number(effect.ko_start_frame) || 0
                    : Number(effect.ko_start_frame) || 0,
                koEndFrame: Number(effect.ko_end_frame) || 0,
            });
            return;
        }

        destroyPlayers();
        const stack = resetStage();
        stack.innerHTML = '';
        activeEffect = koEffects[0];
        activeEffectOptions = options;
        activeMode = 'ko';
        markSelectedEffects(koEffects.map((effect) => String(effect.id)), 'ko');
        setStatus(`Loading ${koEffects.length} KO-screen layers${battleResultEffect ? ' + battle result' : ''}…`);
        try {
            const layers = orderEffectLayers(koEffects);
            if (battleResultEffect) layers.push(battleResultEffect);
            activePlayers = await Promise.all(layers.map(async (effect) => {
                const canvas = document.createElement('canvas');
                canvas.className = 'abs-animation-layer-canvas';
                stack.appendChild(canvas);
                const isBattleResult = effect === battleResultEffect;
                const authoredDamageFrame = Number(effect.ko_damage_frame) || 0;
                const authoredEndFrame = Number(effect.ko_end_frame) || 0;
                const damageRatio = authoredDamageFrame > 0 && authoredEndFrame > authoredDamageFrame
                    ? Math.min(0.985, Math.max(0.5, authoredDamageFrame / authoredEndFrame))
                    : 0;
                const player = await createEffectPlayer(effect, canvas, {
                    ...options,
                    // The shared result starts at its own frame one. The
                    // character layers use `dealDamage` as their local start
                    // so the visible image is the actual finishing exchange.
                    koStartRatio: isBattleResult ? 0 : damageRatio || Number(effect.ko_start_ratio) || 0,
                    koStartFrame: isBattleResult
                        ? 0
                        : authoredDamageFrame || Number(effect.ko_start_frame) || 0,
                    koEndFrame: isBattleResult ? 0 : Number(effect.ko_end_frame) || 0,
                });
                if (isBattleResult) {
                    // battle_170000 is authored as a result plate over the
                    // live battle scene. Keep its native red/yellow lettering
                    // while allowing the authored Piccolo frame beneath it to
                    // remain visible through the plate's fade.
                    canvas.style.mixBlendMode = 'normal';
                    canvas.style.opacity = '0.82';
                }
                return player;
            }));
            setStatus('');
            updateSequenceControls();
        } catch (error) {
            console.error('Dokkan KO-screen preview failed:', error);
            setStatus(error.message || 'The KO-screen layers could not be loaded.', true);
        }
    }

    async function playComposite(payload = activePayload) {
        const effects = (payload?.effects || []).filter((effect) => effect.available && effect.files?.length);
        if (!effects.length) {
            setStatus('None of this animation’s linked LWF packs are available locally.', true);
            return;
        }
        destroyPlayers();
        const stack = resetStage();
        stack.innerHTML = '';
        activeEffect = effects[0];
        activeMode = 'composite';
        markSelectedEffects(effects.map((effect) => String(effect.id)), 'composite');
        setStatus(`Loading ${effects.length} linked animation layers…`);
        try {
            const orderedEffects = orderEffectLayers(effects);
            const loaded = await Promise.all(orderedEffects.map(async (effect) => {
                const canvas = document.createElement('canvas');
                canvas.className = 'abs-animation-layer-canvas';
                stack.appendChild(canvas);
                return createEffectPlayer(effect, canvas);
            }));
            activePlayers = loaded;
            setStatus('');
        } catch (error) {
            console.error('Dokkan composite animation preview failed:', error);
            setStatus(error.message || 'The linked animation layers could not be combined.', true);
        }
    }

    function renderEffectList(payload) {
        const list = document.getElementById('abs-animation-effects');
        list.innerHTML = '';

        // 1. Primary Full Lua Sequence Button (1:1 Playback)
        if (payload?.lua_source) {
            const seqBtn = document.createElement('button');
            seqBtn.type = 'button';
            seqBtn.className = 'abs-animation-effect-btn abs-animation-sequence-btn active';
            seqBtn.innerHTML = `
                <span>▶ Play Full Sequence (1:1)</span>
                <small>Lua ActionBank runtime · timed sequence</small>
            `;
            seqBtn.addEventListener('click', () => playSequence(payload));
            list.appendChild(seqBtn);
        }

        const koEffects = getKoEffects(payload);
        if (koEffects.length) {
            const koButton = document.createElement('button');
            koButton.type = 'button';
            koButton.className = 'abs-animation-effect-btn abs-animation-ko-btn';
            koButton.innerHTML = `
                <span>▶ Play KO Screen</span>
                <small>${koEffects[0].pack_name}</small>
            `;
            koButton.addEventListener('click', () => playKoScreen(payload));
            list.appendChild(koButton);
        }

        // 2. Multi-layer Stack Button (Static stack)
        const availableCount = (payload.effects || []).filter((effect) => effect.available).length;
        if (availableCount > 1) {
            const composite = document.createElement('button');
            composite.type = 'button';
            composite.className = 'abs-animation-effect-btn abs-animation-composite-btn';
            composite.innerHTML = `<span>Play effect stack</span><small>${availableCount} linked LWF layers</small>`;
            composite.addEventListener('click', () => playComposite(payload));
            list.appendChild(composite);
        }

        // 3. Individual Effect Buttons
        for (const effect of payload.effects || []) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'abs-animation-effect-btn';
            button.dataset.effectId = String(effect.id);
            button.disabled = !effect.available;
            button.innerHTML = `
                <span>${effect.primary ? 'Main effect' : 'Effect'} ${effect.id}</span>
                <small>${effect.pack_name} · ${effect.scene_name}${effect.available ? '' : ' · missing'}</small>
            `;
            button.addEventListener('click', () => playEffect(effect));
            list.appendChild(button);
        }

        if (!list.children.length) {
            list.innerHTML = '<div class="abs-animation-empty">No effect-pack IDs were found in this Lua script.</div>';
        }
    }

    async function open(scriptName, label = 'Animation', animationContext = 'sa1', requestedMode = 'sequence') {
        if (!SCRIPT_NAME_PATTERN.test(String(scriptName || ''))) return;
        activeAnimationContext = normalizeAnimationContext(animationContext);
        const overlay = ensureModal();
        overlay.classList.remove('is-closing');
        overlay.hidden = false;
        setAnimationViewport(activeAnimationContext, null, requestedMode);
        document.body.classList.add('abs-animation-open');
        const titleEl = document.getElementById('abs-animation-title');
        if (titleEl) {
            titleEl.textContent = formatAnimationTitle(label, activeAnimationContext, requestedMode);
        }
        const scriptEl = document.getElementById('abs-animation-script');
        if (scriptEl) scriptEl.textContent = scriptName;
        document.getElementById('abs-animation-effects').innerHTML = '';
        const attackerInput = document.getElementById('abs-animation-attacker-id');
        if (attackerInput) attackerInput.value = String(getCurrentCardId());
        setStatus('Connecting to the local animation library…');
        destroyPlayers();

        try {
            const response = await fetchFromAnimationBridge(`/api/animation/${encodeURIComponent(scriptName)}`, { cache: 'no-store' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Animation server returned ${response.status}.`);
            setAnimationViewport(activeAnimationContext, payload, requestedMode);
            await hydrateReferencedKoEffects(payload);
            activePayload = payload;
            revealKoLaunchButtons(scriptName, payload);
            renderEffectList(payload);

            if (requestedMode === 'ko') {
                await playKoScreen(payload);
            } else if (payload.lua_source) {
                await playSequence(payload);
            } else {
                const availableCount = (payload.effects || []).filter((effect) => effect.available).length;
                const primary = payload.effects?.find((effect) => effect.primary && effect.available)
                    || payload.effects?.find((effect) => effect.available);
                if (availableCount > 1) await playComposite(payload);
                else if (primary) await playEffect(primary);
                else setStatus('The Lua script was found, but none of its linked LWF packs are available locally.', true);
            }
        } catch (error) {
            console.error('Local animation server connection failed:', error);
            setStatus('Start start-animation-server.cmd, keep its window open, then press Play again.', true);
        }
    }

    function openKo(scriptName, animationContext = 'sa1') {
        return open(scriptName, 'KO Screen', animationContext, 'ko');
    }

    function restart() {
        if (activeMode === 'sequence' && activePayload) playSequence(activePayload);
        else if (activeMode === 'composite') playComposite(activePayload);
        else if (activeMode === 'ko' && activePayload) playKoScreen(activePayload);
        else if (activeEffect) playEffect(activeEffect, activeEffectOptions || {});
    }

    function close() {
        const overlay = document.getElementById('abs-animation-modal');
        if (!overlay || overlay.hidden) return;
        overlay.classList.add('is-closing');
        setTimeout(() => {
            overlay.classList.remove('is-closing');
            overlay.hidden = true;
            document.body.classList.remove('abs-animation-open');
            activePayload = null;
            activeAnimationContext = 'sa1';
            destroyPlayers();
        }, 200);
    }

    window.DokkanAnimation = {
        buttonHtml,
        close,
        open,
        openKo,
        playSequence,
        playKoScreen,
        resolvePassive,
        mountCounterControls,
        resolveSkill,
        resolveSuperAttack,
        resolveSuperAttackContext,
        scriptFromViewId,
        setServerUrl(url) {
            localStorage.setItem('absDokkanAnimationServer', String(url || DEFAULT_SERVER).replace(/\/$/, ''));
            if (actionBankRunner) actionBankRunner.setServerUrl(url);
        },
    };

    const koButtonObserver = new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) hydrateKoLaunchButtons(node);
            }
        }
    });
    if (document.documentElement) {
        koButtonObserver.observe(document.documentElement, { childList: true, subtree: true });
        hydrateKoLaunchButtons(document);
    }
})();
