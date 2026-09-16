/* Shared native toast API: CardHubToast.show/success/error/loading/promise. */
(() => {
    const ICONS = { default: '✦', success: '✓', error: '!', loading: '◌' };
    const active = new Map();
    let nextId = 0;

    function region() {
        let node = document.getElementById('cardhub-toast-region');
        if (!node) {
            node = document.createElement('div');
            node.id = 'cardhub-toast-region';
            node.setAttribute('aria-live', 'polite');
            node.setAttribute('aria-relevant', 'additions');
            document.body.append(node);
        }
        return node;
    }

    function dismiss(id) {
        const item = active.get(id);
        if (!item) return;
        clearTimeout(item.timer);
        active.delete(id);
        item.node.classList.add('is-leaving');
        window.setTimeout(() => item.node.remove(), 190);
    }

    function show(title, options = {}) {
        const id = ++nextId;
        const type = options.type || 'default';
        const node = document.createElement('article');
        node.className = `cardhub-toast cardhub-toast--${type}`;
        node.setAttribute('role', type === 'error' ? 'alert' : 'status');
        node.innerHTML = `
            <span class="cardhub-toast__icon" aria-hidden="true">${ICONS[type] || ICONS.default}</span>
            <div class="cardhub-toast__content">
                <div class="cardhub-toast__title"></div>
                <div class="cardhub-toast__detail" hidden></div>
            </div>`;
        node.querySelector('.cardhub-toast__title').textContent = String(title || 'Updated');
        const detail = node.querySelector('.cardhub-toast__detail');
        if (options.detail) { detail.textContent = String(options.detail); detail.hidden = false; }
        if (options.action?.label && typeof options.action.onClick === 'function') {
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'cardhub-toast__action';
            action.textContent = options.action.label;
            action.addEventListener('click', () => { options.action.onClick(); dismiss(id); });
            node.querySelector('.cardhub-toast__content').append(action);
        }
        region().append(node);
        while (active.size >= 3) dismiss(active.keys().next().value);
        const duration = options.duration === Infinity ? 0 : Math.max(1200, Number(options.duration) || 3600);
        const timer = duration ? window.setTimeout(() => dismiss(id), duration) : 0;
        active.set(id, { node, timer });
        return id;
    }

    function update(id, title, options = {}) {
        const old = active.get(id);
        if (old) dismiss(id);
        return show(title, options);
    }

    window.CardHubToast = {
        show,
        success: (title, options = {}) => show(title, { ...options, type: 'success' }),
        error: (title, options = {}) => show(title, { ...options, type: 'error', duration: options.duration || 6000 }),
        loading: (title, options = {}) => show(title, { ...options, type: 'loading', duration: Infinity }),
        dismiss,
        update,
        promise(work, messages = {}) {
            const id = show(messages.loading || 'Working…', { type: 'loading', detail: messages.loadingDetail, duration: Infinity });
            return Promise.resolve(work).then((result) => {
                update(id, messages.success || 'Done', { type: 'success', detail: messages.successDetail });
                return result;
            }).catch((error) => {
                update(id, messages.error || 'Something went wrong', { type: 'error', detail: messages.errorDetail || error?.message });
                throw error;
            });
        }
    };
})();
