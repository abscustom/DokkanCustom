/* Safely adapt database card records to the legacy viewer/editor project shape. */
(function () {
    'use strict';

    const SAFE_TAGS = new Set([
        'a', 'abbr', 'article', 'b', 'blockquote', 'br', 'button', 'caption', 'code', 'dd', 'del', 'details',
        'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'hr', 'i', 'img', 'input', 'label', 'legend', 'li', 'ol', 'option', 'p', 'picture', 'pre', 'progress',
        'q', 's', 'section', 'select', 'small', 'source', 'span', 'strong', 'sub', 'summary', 'sup', 'table',
        'tbody', 'td', 'textarea', 'th', 'thead', 'time', 'tr', 'u', 'ul', 'video'
    ]);
    const DROP_TAGS = new Set([
        'applet', 'base', 'embed', 'iframe', 'link', 'math', 'meta', 'noscript', 'object', 'script',
        'style', 'svg', 'template'
    ]);
    const URL_ATTRIBUTES = new Set(['href', 'src', 'poster', 'xlink:href']);
    const SAFE_ATTRIBUTES = new Set([
        'accept', 'alt', 'autocomplete', 'checked', 'class', 'colspan', 'cols', 'controls', 'data-*',
        'decoding', 'disabled', 'for', 'height', 'id', 'label', 'loading', 'loop', 'max', 'maxlength',
        'min', 'minlength', 'multiple', 'muted', 'name', 'open', 'placeholder', 'playsinline', 'preload',
        'readonly', 'rel', 'required', 'role', 'rows', 'rowspan', 'scope', 'selected', 'spellcheck', 'step',
        'style', 'target', 'title', 'type', 'value', 'width', 'wrap'
    ]);
    const RESERVED_IDS = new Set([
        'abs-loading-screen', 'abs-transformations-box', 'abs-transformations-container', 'app', 'card-category-container',
        'card-link-container', 'card-passive-container', 'editor', 'forms-container', 'nav-btn-viewer', 'sidebar-sections-area'
    ]);
    const PASSIVE_SHORTCUTS = new Set([
        ':atk_down:', ':def_down:', ':stun:', ':seal:', ':break:', ':up:', ':down:', ':ydown:', ':once:', ':inf:'
    ]);
    const DEFAULT_FORM_IMAGE = 'https://abscustom.github.io/assets/images/default.png';

    function objectOrEmpty(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function cloneJson(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }

    function rejectEmbeddedMedia(value, path = 'card') {
        if (typeof value === 'string') {
            if (/^data:(?:image|video|audio)\//i.test(value.trim())) {
                throw new Error(`This card still contains embedded media at ${path}; it needs an existing asset URL.`);
            }
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item, index) => rejectEmbeddedMedia(item, `${path}[${index}]`));
            return;
        }
        if (value && typeof value === 'object') {
            Object.entries(value).forEach(([key, item]) => rejectEmbeddedMedia(item, `${path}.${key}`));
        }
    }

    function requireAssetBase(value) {
        let base;
        try {
            base = new URL(String(value || ''));
        } catch {
            throw new Error('This card has an invalid asset base.');
        }
        if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) {
            throw new Error('This card has an invalid asset base.');
        }
        return base.href;
    }

    function safeWebUrl(value, base, allowFragment = false) {
        const raw = String(value || '').trim();
        if (!raw || /^(?:javascript|data|vbscript|blob|file):/i.test(raw)) return '';
        if (allowFragment && raw.startsWith('#')) return raw;
        try {
            const url = new URL(raw, base);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
            return url.href;
        } catch {
            return '';
        }
    }

    function sanitizeStyle(value) {
        const raw = String(value || '');
        if (/(?:url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|-moz-binding)/i.test(raw)) return '';
        const style = document.createElement('span').style;
        style.cssText = raw;
        for (let index = style.length - 1; index >= 0; index -= 1) {
            const property = style[index];
            const content = style.getPropertyValue(property);
            if (/(?:url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|-moz-binding)/i.test(content)) {
                style.removeProperty(property);
            }
        }
        return style.cssText;
    }

    function trustedActionFor(element, name, source) {
        const raw = String(source || '').trim();
        if (name === 'oninput') {
            let match = raw.match(/^updateHeader\(\s*(\d+)\s*,\s*this\.value\s*\)$/);
            if (match) return { action: 'update-header', id: match[1] };
            match = raw.match(/^updateSection\(\s*(\d+)\s*,\s*this\.value\s*\)$/);
            if (match) return { action: 'update-section', id: match[1] };
        }
        if (name === 'onclick') {
            let match = raw.match(/^toggleSectionCollapse\(\s*(\d+)\s*,\s*(?:this|document\.getElementById\(['"]side-toggle-btn-\d+['"]\))\s*\)$/);
            if (match) return { action: 'toggle-section', id: match[1] };
            match = raw.match(/^moveSection\(\s*(\d+)\s*,\s*(-1|1)\s*\)$/);
            if (match) return { action: 'move-section', id: match[1], direction: match[2] };
            match = raw.match(/^confirmDeleteSection\(\s*this\s*,\s*(\d+)\s*\)$/);
            if (match) return { action: 'delete-section', id: match[1] };
            match = raw.match(/^insertShortcut\(\s*['"](input-sec-(?:hdr-)?\d+)['"]\s*,\s*['"]([^'"]{1,80})['"]\s*\)$/);
            if (match && PASSIVE_SHORTCUTS.has(match[2])) {
                const id = match[1].match(/(\d+)$/)?.[1];
                if (id) return { action: 'insert-shortcut', id, target: match[1], token: match[2] };
            }
        }
        return null;
    }

    function isAllowedAttribute(name) {
        const normalized = name.toLowerCase();
        return SAFE_ATTRIBUTES.has(normalized)
            || normalized.startsWith('aria-')
            || normalized.startsWith('data-');
    }

    function sanitizeHtml(markup, assetBase, allowPassiveActions = false) {
        const parsed = new DOMParser().parseFromString(String(markup || ''), 'text/html');
        const comments = parsed.createTreeWalker(parsed.body, NodeFilter.SHOW_COMMENT);
        const commentNodes = [];
        while (comments.nextNode()) commentNodes.push(comments.currentNode);
        commentNodes.forEach(node => node.remove());

        const elements = Array.from(parsed.body.querySelectorAll('*'));
        elements.forEach(element => {
            const tag = element.tagName.toLowerCase();
            if (DROP_TAGS.has(tag)) {
                element.remove();
                return;
            }
            if (!SAFE_TAGS.has(tag)) {
                element.replaceWith(...Array.from(element.childNodes));
                return;
            }

            Array.from(element.attributes).forEach(attribute => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value;
                if (name.startsWith('on')) {
                    const action = allowPassiveActions ? trustedActionFor(element, name, value) : null;
                    if (action) {
                        element.dataset.cardContentAction = action.action;
                        if (action.id) element.dataset.cardContentId = action.id;
                        if (action.direction) element.dataset.cardContentDirection = action.direction;
                        if (action.target) element.dataset.cardContentTarget = action.target;
                        if (action.token) element.dataset.cardContentToken = action.token;
                    }
                    element.removeAttribute(attribute.name);
                    return;
                }
                if (name === 'srcdoc' || name === 'formaction' || name === 'action'
                    || name === 'form' || name === 'method' || name === 'srcset' || name === 'autofocus') {
                    element.removeAttribute(attribute.name);
                    return;
                }
                if (!allowPassiveActions && /^data-card-content-(?:action|id|direction|target|token)$/.test(name)) {
                    element.removeAttribute(attribute.name);
                    return;
                }
                if (name === 'id' && RESERVED_IDS.has(value.toLowerCase())) {
                    element.removeAttribute(attribute.name);
                    return;
                }
                if (URL_ATTRIBUTES.has(name)) {
                    const allowFragment = name === 'href' || name === 'xlink:href';
                    const safe = safeWebUrl(value, assetBase, allowFragment);
                    if (safe) element.setAttribute(attribute.name, safe);
                    else element.removeAttribute(attribute.name);
                    return;
                }
                if (name === 'style') {
                    const safe = sanitizeStyle(value);
                    if (safe) element.setAttribute('style', safe);
                    else element.removeAttribute('style');
                    return;
                }
                if (!isAllowedAttribute(name)) element.removeAttribute(attribute.name);
                else if (name.startsWith('data-') && /(?:src|url|href|poster|asset)/i.test(name)) {
                    const safe = safeWebUrl(value, assetBase);
                    if (safe) element.setAttribute(attribute.name, safe);
                    else element.removeAttribute(attribute.name);
                }
            });

            if (tag === 'a' && element.getAttribute('target') === '_blank') {
                element.setAttribute('rel', 'noopener noreferrer');
            }
            if (tag === 'video') {
                element.removeAttribute('autoplay');
                element.setAttribute('preload', 'none');
            }
            if (tag === 'button') element.setAttribute('type', 'button');
            if (tag === 'input') {
                const allowedInputTypes = new Set(['checkbox', 'color', 'date', 'email', 'file', 'hidden', 'number', 'radio', 'range', 'search', 'tel', 'text', 'url']);
                if (!allowedInputTypes.has(String(element.getAttribute('type') || 'text').toLowerCase())) {
                    element.setAttribute('type', 'text');
                }
            }
        });
        return parsed.body.innerHTML;
    }

    function safePlainText(value) {
        return String(value || '')
            .replace(/<\s*br\s*\/?>/gi, '\n')
            .replace(/<\/\s*(?:div|li|p)\s*>/gi, '\n')
            .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
            .replace(/<[^>]*>/g, '')
            .replace(/[<>]/g, '');
    }

    function safeDisplayText(value, fallback) {
        const text = safePlainText(value).replace(/\s+/g, ' ').trim();
        const defaultText = fallback === undefined ? 'Form' : String(fallback);
        return text.slice(0, 240) || defaultText;
    }

    function stableId(value) {
        const id = String(value || '').trim();
        return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id) ? id : '';
    }

    function viewerHref(id, options) {
        const buildUrl = options?.viewerUrl || window.CardContent?.viewerUrl;
        if (typeof buildUrl !== 'function') throw new Error('The shared card link builder is unavailable.');
        const href = safeWebUrl(buildUrl(id), document.baseURI);
        if (!href) throw new Error('A linked card has an invalid viewer URL.');
        return href;
    }

    function normalizeBuiltinForm(form, assetBase) {
        const source = objectOrEmpty(form);
        const adminLinkedSlug = stableId(source.adminLinkedSlug);
        const targetId = stableId(source.targetId);
        if (source.adminLinkedSlug && !adminLinkedSlug) throw new Error('This card has an invalid managed form reference.');
        if (source.targetId && !targetId) throw new Error('This card has an invalid authored form reference.');
        return {
            name: safeDisplayText(source.name, 'Form'),
            link: safeWebUrl(source.link, assetBase, true),
            imageSrc: safeWebUrl(source.imageSrc, assetBase) || DEFAULT_FORM_IMAGE,
            thumbSrc: safeWebUrl(source.thumbSrc, assetBase) || safeWebUrl(source.imageSrc, assetBase) || DEFAULT_FORM_IMAGE,
            imageExportName: safeDisplayText(source.imageExportName, ''),
            adminLinkedSlug,
            targetId,
            source: 'builtin'
        };
    }

    function linkedForm(card, currentAssetBase, options, matchingBuiltin) {
        const id = stableId(card?.slug || card?.id);
        if (!id) throw new Error('This card has an invalid linked-card reference.');
        const image = safeWebUrl(card.thumb, card.assetBase ? requireAssetBase(card.assetBase) : currentAssetBase)
            || safeWebUrl(matchingBuiltin?.imageSrc, currentAssetBase)
            || DEFAULT_FORM_IMAGE;
        const thumb = image;
        return {
            name: safeDisplayText(matchingBuiltin?.name || card.name || card.title, id),
            link: viewerHref(id, options),
            imageSrc: safeWebUrl(matchingBuiltin?.imageSrc, currentAssetBase) || image,
            thumbSrc: thumb,
            imageExportName: safeDisplayText(matchingBuiltin?.imageExportName, ''),
            adminLinkedSlug: id,
            targetId: id,
            source: 'linked'
        };
    }

    function buildForms(card, assetBase, options) {
        const builtins = Array.isArray(card.builtinForms) ? card.builtinForms : [];
        const linkedCards = Array.isArray(card.linkedCards) ? card.linkedCards : [];
        const linkedById = new Map();
        const portraitCards = new Map([card, ...linkedCards, ...(card.formCards || [])].map(item => [String(item.id || item.slug), item]));
        linkedCards.forEach(linked => {
            const id = stableId(linked?.slug || linked?.id);
            if (!id || id === String(card.id)) throw new Error('This card has an invalid direct form relationship.');
            if (linkedById.has(id)) return;
            linkedById.set(id, linked);
        });

        const forms = [];
        const visibleTargetIds = new Set();
        builtins.forEach(raw => {
            const form = normalizeBuiltinForm(raw, assetBase);
            if (form.adminLinkedSlug) {
                const linked = linkedById.get(form.adminLinkedSlug);
                if (!linked || visibleTargetIds.has(form.adminLinkedSlug)) return;
                forms.push(linkedForm(linked, assetBase, options, form));
                visibleTargetIds.add(form.adminLinkedSlug);
                return;
            }
            if (form.targetId) {
                if (visibleTargetIds.has(form.targetId)) return;
                form.link = viewerHref(form.targetId, options);
                const target = portraitCards.get(form.targetId);
                const portrait = target && safeWebUrl(target.thumb, target.assetBase || assetBase);
                if (portrait) form.thumbSrc = portrait;
                visibleTargetIds.add(form.targetId);
            }
            forms.push(form);
        });

        linkedById.forEach((linked, id) => {
            if (visibleTargetIds.has(id)) return;
            forms.push(linkedForm(linked, assetBase, options, null));
            visibleTargetIds.add(id);
        });
        return forms;
    }

    function buildFormsMarkup(forms, currentType) {
        const type = ['agl', 'teq', 'int', 'str', 'phy', 'none'].includes(String(currentType || '').toLowerCase())
            ? String(currentType).toLowerCase()
            : 'agl';
        const container = document.createElement('div');

        forms.forEach(form => {
            const row = document.createElement('div');
            row.className = `row bg-${type} dokkan-card`;
            row.dataset.formSource = form.source;
            if (form.targetId) row.dataset.targetCardId = form.targetId;
            if (form.thumbSrc) row.dataset.thumbSrc = form.thumbSrc;

            const column = document.createElement('div');
            column.className = 'col';
            column.style.cssText = 'padding: 8px 0 !important;';
            const line = document.createElement('div');
            line.className = 'row align-items-center m-0 w-100';
            const imageColumn = document.createElement('div');
            imageColumn.className = 'col-5 d-flex justify-content-center align-items-center';
            const anchor = document.createElement('a');
            anchor.className = 'form-link';
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.setAttribute('aria-label', `Open ${form.name}`);
            if (form.link) anchor.href = form.link;
            if (form.targetId) anchor.dataset.targetCardId = form.targetId;

            const image = document.createElement('img');
            image.className = 'img-fluid form-image';
            image.src = safeWebUrl(form.imageSrc, document.baseURI) || DEFAULT_FORM_IMAGE;
            image.alt = form.name;
            image.style.cssText = 'max-height: 60px; width: auto; display: block;';
            if (form.imageExportName) image.dataset.exportName = form.imageExportName;
            anchor.appendChild(image);
            imageColumn.appendChild(anchor);

            const nameColumn = document.createElement('div');
            nameColumn.className = 'col-7 form-name form-name-display d-flex justify-content-center align-items-center';
            nameColumn.style.cssText = 'color: #fff; font-weight: normal; font-size: 16px; text-align: center; margin: 0;';
            nameColumn.textContent = form.name;
            line.append(imageColumn, nameColumn);
            column.appendChild(line);
            row.appendChild(column);
            container.appendChild(row);
        });
        return container.innerHTML;
    }

    function sanitizeCompatibilityMarkup(project, assetBase) {
        const containers = objectOrEmpty(project.containers);
        for (const [key, value] of Object.entries(containers)) {
            if (key === 'forms') continue;
            if (typeof value === 'string') {
                containers[key] = sanitizeHtml(value, assetBase, key.toLowerCase() === 'passivesidebar');
            }
        }
        project.containers = containers;

        for (const key of ['activeBlocksHTML', 'saBlocksHTML']) {
            const value = project[key];
            if (Array.isArray(value)) project[key] = value.map(markup => sanitizeHtml(markup, assetBase));
            else if (typeof value === 'string') project[key] = [sanitizeHtml(value, assetBase)];
        }
    }

    const boundEditorRoots = new WeakSet();

    function validatedPassiveAction(element, root) {
        const action = element?.dataset?.cardContentAction || '';
        const id = String(element?.dataset?.cardContentId || '');
        if (!/^\d{1,4}$/.test(id)) return null;
        const section = root.querySelector(`#side-sec-${id}`);
        if (!section || !section.contains(element)) return null;
        const tag = element.tagName.toLowerCase();
        if (action === 'update-header' && tag === 'input' && element.id === `input-sec-hdr-${id}`) return { action, id };
        if (action === 'update-section' && tag === 'textarea' && element.id === `input-sec-${id}`) return { action, id };
        if (action === 'toggle-section' && (tag === 'b' || (tag === 'button' && element.id === `side-toggle-btn-${id}`))) return { action, id };
        if (action === 'move-section' && tag === 'button' && ['-1', '1'].includes(element.dataset.cardContentDirection)) {
            return { action, id, direction: element.dataset.cardContentDirection };
        }
        if (action === 'delete-section' && tag === 'button') return { action, id };
        if (action === 'insert-shortcut' && tag === 'button') {
            const target = String(element.dataset.cardContentTarget || '');
            const token = String(element.dataset.cardContentToken || '');
            const expectedTarget = new RegExp(`^input-sec-(?:hdr-)?${id}$`);
            if (!expectedTarget.test(target) || !PASSIVE_SHORTCUTS.has(token)) return null;
            const targetElement = section.querySelector(`#${target}`);
            if (targetElement) {
                return { action, id, target, token };
            }
        }
        return null;
    }

    function bindEditorControls(root = document) {
        if (!root || typeof root.addEventListener !== 'function' || boundEditorRoots.has(root)) return false;
        const findAction = target => target?.closest?.('[data-card-content-action]');
        root.addEventListener('input', event => {
            const element = findAction(event.target);
            if (!element || !root.contains(element)) return;
            const descriptor = validatedPassiveAction(element, root);
            if (descriptor?.action === 'update-header') window.updateHeader?.(Number(descriptor.id), element.value);
            if (descriptor?.action === 'update-section') window.updateSection?.(Number(descriptor.id), element.value);
        });
        root.addEventListener('click', event => {
            const element = findAction(event.target);
            if (!element || !root.contains(element)) return;
            const descriptor = validatedPassiveAction(element, root);
            if (!descriptor) return;
            const { action, id } = descriptor;
            if (action === 'insert-shortcut') {
                event.preventDefault();
                window.insertShortcut?.(descriptor.target, descriptor.token);
                return;
            }
            if (action === 'update-header' || action === 'update-section') return;
            event.preventDefault();
            if (action === 'toggle-section') window.toggleSectionCollapse?.(Number(id), document.getElementById(`side-toggle-btn-${id}`) || element);
            if (action === 'move-section') window.moveSection?.(Number(id), Number(descriptor.direction));
            if (action === 'delete-section') window.confirmDeleteSection?.(element, id);
        });
        boundEditorRoots.add(root);
        return true;
    }

    function toProject(card, options = {}) {
        if (!card || typeof card !== 'object' || !card.payload || typeof card.payload !== 'object') {
            throw new Error('The card content response is incomplete.');
        }
        const id = stableId(card.id);
        if (!id || card.status && card.status !== 'published') throw new Error('This card is not available.');
        const assetBase = requireAssetBase(card.assetBase);
        rejectEmbeddedMedia(card.payload);
        rejectEmbeddedMedia(card.builtinForms || [], 'builtinForms');
        rejectEmbeddedMedia(card.linkedCards || [], 'linkedCards');
        const project = cloneJson(card.payload);

        project.cardSource = 'custom';
        project.customCardId = id;
        project.customAssetBaseUrl = assetBase;
        project.inputs = objectOrEmpty(project.inputs);
        for (const key of [
            'descInput', 'nameInput', 'leaderInput', 'input-active-name', 'input-active-effect',
            'input-active-type', 'input-active-condition-title', 'input-active-conditions', 'input-passive-name-sidebar'
        ]) {
            if (typeof project.inputs[key] === 'string') project.inputs[key] = safePlainText(project.inputs[key]);
        }
        if (typeof project.inputs.imageInput === 'string') {
            project.inputs.imageInput = safeWebUrl(project.inputs.imageInput, assetBase);
        }
        sanitizeCompatibilityMarkup(project, assetBase);

        const forms = buildForms(card, assetBase, options);
        project.formsData = forms;
        project.containers.forms = buildFormsMarkup(forms, project.currentType);

        for (const field of ['thumbSsr', 'thumbTur', 'thumbLr', 'thumbMain', 'cardArtImage', 'cardArtVideo']) {
            if (typeof project[field] === 'string') project[field] = safeWebUrl(project[field], assetBase);
        }
        return project;
    }

    window.CardContentRenderer = Object.freeze({ toProject, sanitizeHtml, bindEditorControls });
})();
