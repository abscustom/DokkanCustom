(function attachAbsSidebarTwitch(window, document) {
    'use strict';

    if (!window || !document || window.ABSSidebarTwitch) return;

    const VALID_STATUSES = new Set(['checking', 'live', 'offline', 'error']);
    const STATUS_LABELS = Object.freeze({
        checking: 'Checking status',
        live: 'Live now',
        offline: 'Offline',
        error: 'Status unavailable',
        'not-applicable': 'YouTube channel',
    });
    const FALLBACK_ICON_COLORS = Object.freeze({
        theironcane: '#257ca8',
        datruthdt: '#7350a2',
        toonrami: '#177b65',
        slaybix: '#b23f70',
        nanogenix: '#9a7715',
        goresh: '#405da8',
    });

    const state = {
        container: null,
        section: null,
        list: null,
        entries: new Map(),
        items: [],
        tooltip: null,
        eventController: null,
        hoveredLink: null,
        focusedLink: null,
    };

    function safeHandle(value) {
        const handle = String(value || '').trim();
        return /^[A-Za-z0-9_.-]+$/.test(handle) ? handle : '';
    }

    function safeAvatarUrl(value) {
        if (!value) return '';

        try {
            const url = new URL(String(value), document.baseURI);
            return url.protocol === 'https:' ? url.href : '';
        } catch {
            return '';
        }
    }

    function getPlatform(item) {
        if (item.platform === 'youtube' || item.youtubeOnly || (!item.twitch && item.youtube)) {
            return 'youtube';
        }
        return item.platform === 'twitch' || item.twitch ? 'twitch' : '';
    }

    function getStatus(item, platform) {
        if (platform === 'youtube') return 'not-applicable';

        const status = String(item.status || '').trim().toLowerCase();
        if (VALID_STATUSES.has(status)) return status;
        if (status === 'pending' || status === 'unknown') return 'checking';
        if (status === 'failed' || status === 'unavailable') return 'error';

        // Legacy data has only isLive. Treat false as unknown until the poller
        // supplies an explicit offline status.
        return item.isLive === true ? 'live' : 'checking';
    }

    function normalizeItem(item) {
        if (!item || typeof item !== 'object') return null;

        const platform = getPlatform(item);
        if (!platform) return null;

        const handle = safeHandle(platform === 'youtube' ? item.youtube : item.twitch);
        if (!handle) return null;

        const displayName = String(item.displayName || handle).trim();
        if (!displayName) return null;

        const status = getStatus(item, platform);
        const platformName = platform === 'youtube' ? 'YouTube' : 'Twitch';
        const channelUrl = platform === 'youtube'
            ? `https://www.youtube.com/@${encodeURIComponent(handle)}`
            : `https://www.twitch.tv/${encodeURIComponent(handle)}`;

        return {
            key: `${platform}:${handle.toLowerCase()}`,
            handle,
            displayName,
            platform,
            platformName,
            status,
            statusLabel: STATUS_LABELS[status],
            channelUrl,
            avatar: safeAvatarUrl(item.avatar),
        };
    }

    function createEntry() {
        const row = document.createElement('li');
        row.className = 'abs-sidebar-twitch__item';

        const link = document.createElement('a');
        link.className = 'abs-sidebar-twitch__link';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const avatar = document.createElement('span');
        avatar.className = 'abs-sidebar-twitch__avatar';
        avatar.setAttribute('aria-hidden', 'true');

        const fallback = document.createElement('span');
        fallback.className = 'abs-sidebar-twitch__fallback';

        const copy = document.createElement('span');
        copy.className = 'abs-sidebar-twitch__copy';

        const name = document.createElement('span');
        name.className = 'abs-sidebar-twitch__name';

        const status = document.createElement('span');
        status.className = 'abs-sidebar-twitch__status';

        copy.append(name, status);
        avatar.append(fallback);
        link.append(avatar, copy);
        row.append(link);

        return { row, link, avatar, fallback, copy, name, status, image: null, imageUrl: '' };
    }

    function updateAvatar(entry, item) {
        const color = FALLBACK_ICON_COLORS[item.handle.toLowerCase()] || '#4c586d';
        entry.avatar.style.setProperty('--abs-sidebar-twitch-fallback', color);
        entry.fallback.textContent = item.displayName.charAt(0).toUpperCase();

        if (entry.imageUrl === item.avatar) return;

        entry.image?.remove();
        entry.image = null;
        entry.imageUrl = item.avatar;
        entry.avatar.classList.remove('has-image');

        if (!item.avatar) return;

        const image = document.createElement('img');
        image.className = 'abs-sidebar-twitch__image';
        image.alt = '';
        image.loading = 'lazy';
        image.referrerPolicy = 'no-referrer';
        image.addEventListener('load', () => {
            if (entry.image === image) entry.avatar.classList.add('has-image');
        }, { once: true });
        image.addEventListener('error', () => {
            if (entry.image !== image) return;
            entry.avatar.classList.remove('has-image');
            image.remove();
            entry.image = null;
        }, { once: true });
        entry.image = image;
        entry.avatar.append(image);
        image.src = item.avatar;
    }

    function updateEntry(entry, item) {
        const description = item.status === 'live'
            ? `${item.displayName} — ${item.platformName}`
            : `${item.displayName} — ${item.statusLabel} on ${item.platformName}`;
        entry.link.href = item.channelUrl;
        entry.link.dataset.status = item.status;
        entry.link.dataset.channel = item.handle.toLowerCase();
        entry.link.dataset.streamerTooltip = description;
        entry.link.removeAttribute('data-tooltip');
        entry.link.removeAttribute('title');
        entry.link.setAttribute(
            'aria-label',
            `Open ${item.displayName}'s ${item.platformName} channel. ${item.statusLabel}. Opens in a new tab.`,
        );
        entry.name.textContent = item.displayName;
        entry.status.textContent = item.status === 'live'
            ? ''
            : item.status === 'not-applicable' ? 'YouTube' : item.statusLabel;
        entry.status.dataset.status = item.status;
        entry.status.hidden = item.status === 'live';
        entry.avatar.dataset.platform = item.platform;
        entry.avatar.dataset.status = item.status;
        updateAvatar(entry, item);
    }

    function renderItems() {
        if (!state.list) return;

        const orderedEntries = [];
        const nextEntries = new Map();

        state.items.forEach((item) => {
            let entry = state.entries.get(item.key);
            if (!entry) entry = createEntry();
            updateEntry(entry, item);
            nextEntries.set(item.key, entry);
            orderedEntries.push(entry);
        });

        let nextNode = state.list.firstElementChild;
        orderedEntries.forEach((entry) => {
            if (entry.row !== nextNode) state.list.insertBefore(entry.row, nextNode);
            nextNode = entry.row.nextElementSibling;
        });

        state.entries.forEach((entry, key) => {
            if (!nextEntries.has(key)) entry.row.remove();
        });
        state.entries = nextEntries;
    }

    function getLink(target) {
        if (!(target instanceof window.Element)) return null;
        return target.closest('.abs-sidebar-twitch__link');
    }

    function isCollapsedLayout() {
        return Boolean(state.container && state.container.getBoundingClientRect().width <= 132);
    }

    function hideTooltip() {
        if (!state.tooltip) return;
        state.tooltip.hidden = true;
        state.tooltip.textContent = '';
    }

    function showTooltip(link) {
        if (!link || !link.isConnected || !state.container?.contains(link) || !isCollapsedLayout()) {
            hideTooltip();
            return;
        }

        if (!state.tooltip) {
            const tooltip = document.createElement('div');
            tooltip.id = 'abs-sidebar-twitch-tooltip';
            tooltip.className = 'abs-sidebar-twitch-tooltip';
            tooltip.setAttribute('role', 'tooltip');
            tooltip.setAttribute('aria-hidden', 'true');
            tooltip.hidden = true;
            document.body.append(tooltip);
            state.tooltip = tooltip;
        }

        state.tooltip.textContent = link.dataset.streamerTooltip || link.getAttribute('aria-label') || '';
        state.tooltip.hidden = false;

        const anchor = link.getBoundingClientRect();
        const tooltip = state.tooltip.getBoundingClientRect();
        const edge = 8;
        const gap = 9;
        let left = anchor.right + gap;
        if (left + tooltip.width > window.innerWidth - edge) {
            left = Math.max(edge, anchor.left - tooltip.width - gap);
        }
        const top = Math.max(edge, Math.min(
            anchor.top + (anchor.height - tooltip.height) / 2,
            window.innerHeight - tooltip.height - edge,
        ));

        state.tooltip.style.left = `${Math.round(left)}px`;
        state.tooltip.style.top = `${Math.round(top)}px`;
    }

    function syncTooltip() {
        const activeLink = state.list?.contains(document.activeElement)
            ? getLink(document.activeElement)
            : null;
        if (activeLink) state.focusedLink = activeLink;
        else if (!state.focusedLink?.matches(':focus')) state.focusedLink = null;

        showTooltip(state.focusedLink || state.hoveredLink);
    }

    function bindTooltipEvents(list) {
        const controller = new window.AbortController();
        const options = { signal: controller.signal };
        list.addEventListener('pointerover', (event) => {
            const link = getLink(event.target);
            if (!link || link.contains(event.relatedTarget)) return;
            state.hoveredLink = link;
            syncTooltip();
        }, options);
        list.addEventListener('pointerout', (event) => {
            const link = getLink(event.target);
            if (!link || link.contains(event.relatedTarget)) return;
            if (state.hoveredLink === link) state.hoveredLink = null;
            syncTooltip();
        }, options);
        list.addEventListener('focusin', (event) => {
            state.focusedLink = getLink(event.target);
            syncTooltip();
        }, options);
        list.addEventListener('focusout', () => {
            window.setTimeout(() => {
                state.focusedLink = state.list?.contains(document.activeElement)
                    ? getLink(document.activeElement)
                    : null;
                syncTooltip();
            }, 0);
        }, options);

        const reposition = () => syncTooltip();
        window.addEventListener('resize', reposition, { ...options, passive: true });
        window.addEventListener('scroll', reposition, { ...options, capture: true, passive: true });
        window.addEventListener('abs-shell-layout-change', reposition, options);
        state.eventController = controller;
    }

    function clearMountedComponent() {
        state.eventController?.abort();
        state.eventController = null;
        state.tooltip?.remove();
        state.tooltip = null;
        state.section?.remove();
        state.container = null;
        state.section = null;
        state.list = null;
        state.entries = new Map();
        state.hoveredLink = null;
        state.focusedLink = null;
    }

    function mount(container) {
        const target = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        if (!target || typeof target.append !== 'function') return false;

        if (state.container !== target) {
            clearMountedComponent();
            state.container = target;

            const section = document.createElement('section');
            section.className = 'abs-sidebar-twitch';
            section.setAttribute('role', 'group');
            section.setAttribute('aria-label', 'Streamer channels');

            const list = document.createElement('ul');
            list.className = 'abs-sidebar-twitch__list';

            section.append(list);
            target.append(section);
            state.section = section;
            state.list = list;
            bindTooltipEvents(list);
        }

        renderItems();
        syncTooltip();
        return true;
    }

    function update(items) {
        const seen = new Set();
        state.items = (Array.isArray(items) ? items : [])
            .map(normalizeItem)
            .filter((item) => {
                if (!item || seen.has(item.key)) return false;
                seen.add(item.key);
                return true;
            });
        renderItems();
        syncTooltip();
    }

    function unmount() {
        clearMountedComponent();
    }

    window.ABSSidebarTwitch = Object.freeze({ mount, update, unmount });
})(window, document);
