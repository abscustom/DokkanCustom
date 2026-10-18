/* Open Manager plane for existing reciprocal form links. Apply is the only write boundary. */
(() => {
    'use strict';

    const start = () => {
        const root = document.getElementById('manager-coin-workspace');
        const plane = document.getElementById('manager-coin-plane');
        if (!root || !plane || root.dataset.initialized === 'plane') return;
        root.dataset.initialized = 'plane';

        const el = id => document.getElementById('manager-coin-' + id);
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        let cards = [];
        let cardIndex = new Map();
        let connectionCounts = new Map();
        let base = '';
        let savedEdges = new Set();
        let staged = new Map();
        let history = [];
        let positions = new Map();
        let candidate = '';
        const targets = new Set();
        let pairStarted = false;
        let hasLoadedCards = false;
        let layoutGroups = [];
        let drag = null;
        let applying = false;

        const key = (a, b) => [a, b].sort((x, y) => x.localeCompare(y)).join('\u0000');
        const pair = k => k.split('\u0000');
        const card = slug => cardIndex.get(slug);
        const saved = (a, b) => savedEdges.has(key(a, b));
        const wanted = (a, b) => staged.has(key(a, b)) ? staged.get(key(a, b)).value : saved(a, b);
        const edgeVisible = (a, b) => wanted(a, b) || (saved(a, b) && staged.get(key(a, b))?.value === false);
        const pending = () => staged.size > 0;
        const say = message => { el('status').textContent = message; };

        function remember() {
            history.push(new Map([...staged].map(([k, value]) => [k, { ...value }])));
        }

        function groupSlugs() {
            return components().find(group => group.includes(base)) || (base ? [base] : []);
        }

        function visiblePairs() {
            return [...new Set([...savedEdges, ...staged.keys()])]
                .map(pair).filter(([a, b]) => card(a) && card(b) && edgeVisible(a, b));
        }

        function components() {
            const neighbors = new Map(cards.map(item => [item.slug, new Set()]));
            visiblePairs().forEach(([a, b]) => { neighbors.get(a).add(b); neighbors.get(b).add(a); });
            const visited = new Set();
            return cards.flatMap(item => {
                if (visited.has(item.slug)) return [];
                const group = [], queue = [item.slug];
                visited.add(item.slug);
                for (let index = 0; index < queue.length; index += 1) {
                    const slug = queue[index];
                    group.push(slug);
                    neighbors.get(slug).forEach(other => {
                        if (!visited.has(other)) { visited.add(other); queue.push(other); }
                    });
                }
                return [group];
            });
        }

        function connectionCount(slug) {
            return connectionCounts.get(slug) || 0;
        }

        function resetPair() {
            targets.clear();
            base = '';
            candidate = '';
            pairStarted = false;
            render();
            say('Choose the first card for another pair. All saved and staged connections remain visible.');
        }

        function stage(a, b, value) {
            if (applying || !card(a) || !card(b) || a === b || wanted(a, b) === value) return false;

            remember();
            const k = key(a, b);
            if (saved(a, b) === value) staged.delete(k);
            else staged.set(k, { value, baseSlug: a, otherSlug: b });
            candidate = '';

            arrangeLinkedGroup();
            render();
            say(`${card(a).name} ↔ ${card(b).name}: ${value ? 'link' : 'removal'} staged. ${staged.size} pending change${staged.size === 1 ? '' : 's'}; Apply to save.`);
            return true;
        }

        function selectMain(slug, { focus = false } = {}) {
            targets.clear();
            if (applying) return false;
            if (!slug) { resetPair(); return true; }
            if (!card(slug)) return false;

            base = slug;
            candidate = '';
            pairStarted = true;
            el('base').value = slug;
            render();
            say(`${card(slug).name} selected as the first card. Choose a target portrait; Clear Both starts a fresh pair.`);

            if (focus) {
                plane.querySelector(`[data-coin-slug="${CSS.escape(slug)}"]`)?.focus({ preventScroll: true });
            }
            return true;
        }

        function selectPairCoin(slug) {
            if (!card(slug) || applying) return false;

            if (!pairStarted) {
                base = slug;
                candidate = '';
                pairStarted = true;
                el('base').value = slug;
                render();
                say(`${card(slug).name} selected as the first card. Choose another portrait as the target.`);
                return true;
            }

            if (slug === base) {
                targets.clear();
                if (candidate) {
                    candidate = '';
                    render();
                    say(`${card(base).name} remains the first card. The target selection was cleared.`);
                } else {
                    say(`${card(base).name} is the first card. Choose another portrait as the target.`);
                }
                return true;
            }

            if (targets.has(slug)) targets.delete(slug);
            else targets.add(slug);
            candidate = [...targets].at(-1) || '';
            render();
            say(wanted(base, slug)
                ? `${card(base).name} ↔ ${card(slug).name} is already linked. Use Unlink Selected Form to stage its removal.`
                : `${card(base).name} is the first card; ${card(slug).name} is the target. Link Selected Pair stages this connection.`);
            return true;
        }

        function ensurePositions(width) {
            const cols = Math.max(2, Math.floor(Math.max(300, width - 100) / 112));
            cards.forEach((item, index) => {
                if (positions.has(item.slug)) return;
                const col = index % cols;
                const row = Math.floor(index / cols);
                const edge = Math.min(46, 50 / Math.max(1, width) * 100);
                positions.set(item.slug, {
                    x: cols === 1 ? 50 : edge + col * ((100 - 2 * edge) / (cols - 1)),
                    y: 70 + row * 132
                });
            });
            const baseHeight = Math.max(480, Math.ceil(cards.length / cols) * 132 + 190);
            const currentHeight = Number.parseFloat(plane.style.minHeight) || 0;
            if (!layoutGroups.length) plane.style.minHeight = Math.max(baseHeight, currentHeight) + 'px';
        }

        function arrangeLinkedGroup() {
            const width = Math.max(1, plane.clientWidth || 640);
            ensurePositions(width);
            const edges = visiblePairs();
            connectionCounts = new Map(cards.map(item => [item.slug, 0]));
            edges.forEach(([a, b]) => {
                if (wanted(a, b)) { connectionCounts.set(a, connectionCount(a) + 1); connectionCounts.set(b, connectionCount(b) + 1); }
            });
            const allGroups = components();
            const linkedGroups = allGroups.filter(group => group.length > 1);
            const isolated = allGroups.filter(group => group.length === 1).flat();
            const maxCols = Math.max(1, Math.floor((width - 120) / 104) + 1);
            let left = 14, top = 12, shelfHeight = 0;
            layoutGroups = [];
            const place = (members, label, kind, index) => {
                const columns = Math.min(maxCols, members.length);
                const rows = Math.ceil(members.length / columns);
                const blockWidth = (columns - 1) * 104 + 92;
                const blockHeight = rows * 132 + 28;
                if (left > 14 && left + blockWidth > width - 14) {
                    left = 14; top += shelfHeight + 30; shelfHeight = 0;
                }
                const ordered = [...members];
                const neighbors = new Map(members.map(slug => [slug, []]));
                edges.filter(([a, b]) => neighbors.has(a) && neighbors.has(b)).forEach(([a, b]) => { neighbors.get(a).push(b); neighbors.get(b).push(a); });
                const endpoint = members.find(slug => neighbors.get(slug).length === 1);
                const isPath = kind === 'linked' && endpoint && [...neighbors.values()].every(list => list.length <= 2);
                if (isPath) {
                    ordered.length = 0;
                    let previous = '', current = endpoint;
                    while (current) {
                        ordered.push(current);
                        const next = neighbors.get(current).find(slug => slug !== previous);
                        previous = current; current = next;
                    }
                } else if (kind === 'linked' && members.length > 2 && members.length <= maxCols) {
                    const rootSlug = [...members].sort((a, b) => connectionCount(b) - connectionCount(a))[0];
                    ordered.splice(ordered.indexOf(rootSlug), 1);
                    ordered.splice(Math.floor(members.length / 2), 0, rootSlug);
                }
                ordered.forEach((slug, offset) => positions.set(slug, {
                    x: (left + 46 + (isPath && Math.floor(offset / columns) % 2 ? columns - 1 - offset % columns : offset % columns) * 104) / width * 100,
                    y: top + 78 + Math.floor(offset / columns) * 132
                }));
                layoutGroups.push({ id: `group-${members[0]}`, members, label, kind, index, left, top, width: blockWidth, height: blockHeight });
                left += blockWidth + 36;
                shelfHeight = Math.max(shelfHeight, blockHeight);
            };
            linkedGroups.forEach((members, index) => {
                const links = edges.filter(([a, b]) => members.includes(a) && members.includes(b)).length;
                place(members, `Group ${index + 1} · ${members.length} cards · ${links} link${links === 1 ? '' : 's'}`, 'linked', index);
            });
            if (isolated.length) {
                if (left > 14) { left = 14; top += shelfHeight + 30; shelfHeight = 0; }
                place(isolated, `Unlinked cards · ${isolated.length}`, 'unlinked', linkedGroups.length);
            }
            plane.style.minHeight = Math.max(480, top + shelfHeight + 100) + 'px';
        }

        function makeCoin(item) {
            const pendingChange = staged.get(key(base, item.slug));
            const changes = [...staged].filter(([edge]) => pair(edge).includes(item.slug)).map(([, change]) => change.value);
            const connections = connectionCount(item.slug);
            const cluster = layoutGroups.find(group => group.members.includes(item.slug));
            const isFirst = pairStarted && item.slug === base;
            const role = isFirst
                ? 'base'
                : pairStarted && wanted(base, item.slug)
                    ? 'linked'
                    : pendingChange?.value === false
                        ? 'pending-remove'
                        : connections > 0 ? 'connected' : changes.includes(false) ? 'pending-remove' : 'available';
            const isTarget = pairStarted && targets.has(item.slug);
            const node = document.createElement('button');

            node.type = 'button';
            node.title = `${item.name} — ${connections} direct form link${connections === 1 ? '' : 's'}`;
            node.className = 'manager-coin';
            node.dataset.coinSlug = item.slug;
            node.dataset.coinRole = role;
            node.dataset.selectionRole = isFirst ? 'first' : isTarget ? 'target' : '';
            node.dataset.type = item.type;
            node.dataset.connectionCount = String(connections);
            node.dataset.componentId = cluster?.kind === 'linked' ? cluster.id : `isolated-${item.slug}`;
            node.dataset.componentIndex = String(cluster?.index || 0);
            node.dataset.pendingAction = changes.length ? changes.every(Boolean) ? 'add' : changes.every(value => !value) ? 'remove' : 'mixed' : '';
            const roleText = role === 'base'
                ? 'selected first card'
                : role === 'linked'
                    ? 'linked to ' + (card(base)?.name || 'the first card')
                    : role === 'pending-remove'
                        ? 'link removal staged for ' + (card(base)?.name || 'the first card')
                        : connections ? `${connections} current connection${connections === 1 ? '' : 's'} in another group` : 'unlinked custom card';
            node.setAttribute('aria-label', `${item.name}, ${roleText}${isTarget ? ', selected as the link target' : ''}${changes.length ? `, ${changes.length} staged change${changes.length === 1 ? '' : 's'}` : ''}`);
            node.setAttribute('aria-pressed', String(isFirst || isTarget));
            node.setAttribute('aria-describedby', 'manager-coin-status');
            node.classList.toggle('is-selected', isFirst);
            node.classList.toggle('is-target', isTarget);
            node.classList.toggle('is-pending', changes.length > 0);
            node.classList.toggle('is-connected', cluster?.kind === 'linked');
            node.disabled = applying;

            const position = positions.get(item.slug);
            node.style.left = position.x + '%';
            node.style.top = position.y + 'px';
            node.style.touchAction = 'none';

            const frame = document.createElement('span');
            frame.className = 'manager-coin-portrait';
            const image = document.createElement('img');
            image.src = item.thumb;
            image.alt = '';
            image.loading = 'lazy';
            image.draggable = false;
            image.addEventListener('error', () => {
                image.hidden = true;
                frame.textContent = item.name.slice(0, 2);
            }, { once: true });
            frame.append(image);

            const name = document.createElement('span');
            name.className = 'manager-coin-name';
            name.textContent = item.name;
            node.append(frame, name);
            if (isFirst || isTarget) {
                const label = document.createElement('span');
                label.className = 'manager-coin-role manager-coin-selection-label';
                label.dataset.selectionRole = isFirst ? 'first' : 'target';
                label.textContent = isFirst ? 'FIRST CARD' : 'TARGET';
                node.append(label);
            }
            node.addEventListener('click', () => {
                if (plane.dataset.suppressClick === 'true') return;
                selectPairCoin(item.slug);
            });
            return node;
        }

        function renderLines() {
            const svg = el('links');
            if (!svg) return;

            const svgRect = svg.getBoundingClientRect();
            svg.setAttribute('viewBox', `0 0 ${Math.max(1, svgRect.width)} ${Math.max(1, svgRect.height)}`);
            svg.replaceChildren();
            for (const [a, b] of visiblePairs()) {
                const firstNode = plane.querySelector(`[data-coin-slug="${CSS.escape(a)}"]`);
                const firstFrame = (drag?.slug === a && drag.ghost ? drag.ghost : firstNode)?.querySelector('.manager-coin-portrait');
                if (!firstFrame || firstNode.hidden) continue;
                const firstRect = firstFrame.getBoundingClientRect();
                const firstCenter = {
                    x: firstRect.left + firstRect.width / 2 - svgRect.left,
                    y: firstRect.top + firstRect.height / 2 - svgRect.top
                };
                const otherNode = plane.querySelector(`[data-coin-slug="${CSS.escape(b)}"]`);
                const otherFrame = (drag?.slug === b && drag.ghost ? drag.ghost : otherNode)?.querySelector('.manager-coin-portrait');
                if (!otherFrame || otherNode.hidden) continue;

                const otherRect = otherFrame.getBoundingClientRect();
                const otherCenter = {
                    x: otherRect.left + otherRect.width / 2 - svgRect.left,
                    y: otherRect.top + otherRect.height / 2 - svgRect.top
                };
                const dx = otherCenter.x - firstCenter.x;
                const dy = otherCenter.y - firstCenter.y;
                const distance = Math.hypot(dx, dy) || 1;
                const firstRadius = Math.min(firstRect.width, firstRect.height) / 2;
                const otherRadius = Math.min(otherRect.width, otherRect.height) / 2;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', firstCenter.x + dx / distance * firstRadius);
                line.setAttribute('y1', firstCenter.y + dy / distance * firstRadius);
                line.setAttribute('x2', otherCenter.x - dx / distance * otherRadius);
                line.setAttribute('y2', otherCenter.y - dy / distance * otherRadius);

                line.dataset.linkFrom = a;
                line.dataset.linkTo = b;
                line.classList.toggle('is-active', pairStarted && (a === base || b === base));
                const change = staged.get(key(a, b));
                if (change?.value === false) line.classList.add('is-removing');
                else if (change?.value === true) line.classList.add('is-staged');
                svg.append(line);
            }
        }

        function actions() {
            el('base').disabled = applying;
            el('apply').disabled = applying || !pending();
            el('undo').disabled = applying || !history.length;
            el('revert').disabled = applying || !pending();
            el('link-selected').disabled = applying || !pairStarted || !base || !candidate || candidate === base || wanted(base, candidate);
            el('unlink-selected').disabled = applying || !pairStarted || !base || !candidate || candidate === base || !wanted(base, candidate);
            const clearPair = el('clear-pair');
            if (clearPair) clearPair.disabled = applying || !candidate;
            const newPair = el('new-pair');
            if (newPair) newPair.disabled = applying || (!pairStarted && !candidate);
            const additions = [...staged.values()].filter(change => change.value).length;
            const removals = staged.size - additions;
            if (el('summary')) el('summary').textContent = `${savedEdges.size} saved links · ${additions} addition${additions === 1 ? '' : 's'} · ${removals} removal${removals === 1 ? '' : 's'} pending`;
            el('apply').textContent = pending() ? `Apply ${staged.size} Change${staged.size === 1 ? '' : 's'}` : 'Apply Changes';
            el('unlink-all').disabled = applying || !pairStarted || !base || !cards.some(item => item.slug !== base && wanted(base, item.slug));
            const first = pairStarted ? card(base) : null;
            const target = first ? card(candidate) : null;
            let selectionState = 'empty';
            let nextStep = cards.length ? '1. Select a first card in the workspace.' : 'Sign in and load cards to start selecting a pair.';
            let linkReason = 'Choose a first card and a target to enable linking.';
            let linkLabel = 'Link Selected Pair';
            if (first && !target) {
                selectionState = pending() ? 'staged' : 'first-only';
                nextStep = pending()
                    ? `${staged.size} change${staged.size === 1 ? '' : 's'} staged. Choose another target, start another pair, or Apply to save.`
                    : '2. Select another portrait as the target.';
                linkReason = 'Choose a target to enable linking.';
            } else if (first && target) {
                const change = staged.get(key(base, candidate));
                if (change?.value === false) {
                    selectionState = 'restore';
                    nextStep = 'Restore Selected Link cancels this pending removal.';
                    linkReason = 'Removal is staged for this saved pair. Restore keeps its existing link.';
                    linkLabel = 'Restore Selected Link';
                } else if (wanted(base, candidate)) {
                    selectionState = change?.value === true ? 'already-staged' : 'already-linked';
                    nextStep = change?.value === true
                        ? 'This link is staged. Apply saves it; Unlink cancels the staged addition.'
                        : 'This pair is already linked. Unlink Selected Form stages its removal.';
                    linkReason = change?.value === true ? 'Already staged for linking; no duplicate is needed.' : 'Already linked; choose another target or use Unlink.';
                } else {
                    selectionState = 'ready';
                    nextStep = '3. Link Selected Pair stages this connection. Apply saves staged changes.';
                    linkReason = `Ready to link ${first.name} ↔ ${target.name}.`;
                }
            }
            if (applying) {
                selectionState = 'saving';
                nextStep = 'Saving all staged relationships…';
                linkReason = 'Wait for saving to finish before changing the pair.';
            }
            const setSelectionText = (id, value) => { if (el(id)) el(id).textContent = value; };
            setSelectionText('first-name', first?.name || 'Not selected');
            setSelectionText('target-name', target?.name || 'Not selected');
            setSelectionText('next-step', nextStep);
            setSelectionText('link-reason', linkReason);
            if (el('pair-summary')) el('pair-summary').dataset.selectionState = selectionState;
            if (el('selection-panel')) el('selection-panel').dataset.step = ({ empty: 'first', 'first-only': 'target', staged: 'staged', ready: 'link', restore: 'link', 'already-linked': 'already-linked', 'already-staged': 'staged', saving: 'applying' })[selectionState];
            el('first-name')?.setAttribute('data-empty', String(!first));
            el('target-name')?.setAttribute('data-empty', String(!target));
            el('link-selected').textContent = linkLabel;
            el('link-selected').setAttribute('aria-describedby', 'manager-coin-selection-hint');
            root.setAttribute('aria-busy', String(applying));
            if (targets.size) {
                el('link-selected').disabled = applying || ![...targets].some(slug => !wanted(base, slug));
                el('unlink-selected').disabled = applying || ![...targets].some(slug => wanted(base, slug));
                el('link-selected').textContent = `Link ${targets.size} Selected Form${targets.size === 1 ? '' : 's'}`;
                setSelectionText('target-name', `${targets.size} selected`);
                setSelectionText('next-step', 'Click more coins to toggle targets. Link/Unlink stages direct links to the first card; Apply saves them.');
            }
        }

        function render() {
            const query = el('search').value.trim().toLowerCase();
            const focusedSlug = plane.contains(document.activeElement) ? document.activeElement.dataset.coinSlug : '';
            ensurePositions(plane.clientWidth || 640);
            plane.querySelectorAll('.manager-coin').forEach(node => node.remove());
            plane.querySelectorAll('.manager-coin-group-label').forEach(node => node.remove());
            layoutGroups.forEach(group => {
                const label = document.createElement('div');
                label.className = 'manager-coin-group-label';
                label.textContent = group.label;
                label.dataset.componentId = group.id;
                const points = group.members.map(slug => positions.get(slug));
                label.style.left = Math.min(...points.map(point => point.x * plane.clientWidth / 100 - 46)) + 'px';
                label.style.top = Math.min(...points.map(point => point.y - 78)) + 'px';
                label.style.width = group.width + 'px';
                plane.append(label);
            });

            for (const item of cards) {
                const node = makeCoin(item);
                node.hidden = Boolean(query && !`${item.name} ${item.title} ${item.slug}`.toLowerCase().includes(query));
                plane.append(node);
            }

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Choose first card';
            el('base').replaceChildren(placeholder, ...cards.map(item => {
                const option = document.createElement('option');
                option.value = item.slug;
                option.textContent = `${item.name} — ${item.slug}`;
                return option;
            }));
            el('base').value = pairStarted ? base : '';
            actions();
            requestAnimationFrame(renderLines);
            if (focusedSlug) plane.querySelector(`[data-coin-slug="${CSS.escape(focusedSlug)}"]:not([hidden])`)?.focus({ preventScroll: true });
        }

        function refresh() {
            targets.clear();
            const snapshot = window.CardAdminCoins.getSnapshot();
            cards = snapshot.cards;
            cardIndex = new Map(cards.map(item => [item.slug, item]));
            const valid = new Set(cards.map(item => item.slug));

            if (!snapshot.authenticated) {
                base = '';
                savedEdges.clear();
                staged.clear();
                history = [];
                positions.clear();
                candidate = '';
                pairStarted = false;
                hasLoadedCards = false;
                layoutGroups = [];
            }
            if (!hasLoadedCards && cards.length) {
                base = cards[0]?.slug || '';
                candidate = '';
                pairStarted = false;
                hasLoadedCards = true;
            } else if (base && !card(base)) {
                base = ''; candidate = ''; pairStarted = false;
            }
            if (!card(candidate) || candidate === base) candidate = '';

            savedEdges = new Set(cards.flatMap(item =>
                item.links.filter(slug => valid.has(slug) && slug !== item.slug).map(slug => key(item.slug, slug))
            ));
            const keys = new Set([...savedEdges, ...staged.keys()]);
            for (const k of keys) {
                const [a, b] = pair(k);
                if (!valid.has(a) || !valid.has(b)) {
                    staged.delete(k);
                    history = [];
                }
            }

            arrangeLinkedGroup();
            render();
        }

        function restoreDragPositions(activeDrag) {
            if (activeDrag.originPositions) {
                activeDrag.originPositions.forEach((position, slug) => positions.set(slug, { ...position }));
            } else if (activeDrag.origin) {
                positions.set(activeDrag.slug, { ...activeDrag.origin });
            }
        }

        function clearHoverLink(activeDrag) {
            clearTimeout(activeDrag.hoverTimer);
            activeDrag.hoverTarget?.querySelector('.manager-link-progress')?.remove();
            activeDrag.hoverTarget?.classList.remove('is-link-hover');
            activeDrag.hoverTarget = null;
        }

        function hoverLink(activeDrag, target) {
            if (activeDrag.hoverTarget === target) return;
            clearHoverLink(activeDrag);
            if (!target) return;
            activeDrag.hoverTarget = target;
            target.classList.add('is-link-hover');
            const progress = document.createElement('span');
            progress.className = 'manager-link-progress';
            progress.setAttribute('aria-hidden', 'true');
            progress.append(document.createElement('span'));
            target.append(progress);
            activeDrag.hoverTimer = setTimeout(() => {
                if (drag !== activeDrag || !target.isConnected) return;
                const source = activeDrag.slug, destination = target.dataset.coinSlug;
                cancel({ restore: true });
                base = destination;
                targets.clear();
                pairStarted = true;
                stage(destination, source, true);
                say('Form link staged after holding for three seconds. Apply Changes saves it.');
            }, 3000);
        }

        function cancel({ restore = false } = {}) {
            if (!drag) return;

            const activeDrag = drag;
            clearHoverLink(activeDrag);
            drag = null;
            if (activeDrag.node.hasPointerCapture(activeDrag.id)) activeDrag.node.releasePointerCapture(activeDrag.id);
            activeDrag.node.style.pointerEvents = '';
            activeDrag.ghost?.remove();
            plane.classList.remove('is-dragging');
            plane.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));
            if (restore) restoreDragPositions(activeDrag);
            render();
        }

        plane.addEventListener('pointerdown', event => {
            const node = event.target.closest('[data-coin-slug]');
            if (!node || applying || event.button !== 0) return;

            const slug = node.dataset.coinSlug;
            const members = [slug];
            const originPositions = new Map(members.map(member => {
                const position = positions.get(member);
                return [member, { ...position }];
            }));
            drag = {
                node,
                slug,
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                origin: { ...positions.get(slug) },
                originPositions,
                groupSlugs: members,
                linkedMember: (!pairStarted || slug !== base) && components().some(group => group.length > 1 && group.includes(slug)),
                moved: false,
                distance: 0
            };
            node.setPointerCapture(event.pointerId);
        });

        plane.addEventListener('pointermove', event => {
            if (!drag || drag.id !== event.pointerId) return;

            const activeDrag = drag;
            const travel = Math.hypot(event.clientX - activeDrag.x, event.clientY - activeDrag.y);
            activeDrag.distance = Math.max(activeDrag.distance, travel);
            if (travel < 7 && !activeDrag.moved) return;

            event.preventDefault();
            activeDrag.moved = true;
            plane.classList.add('is-dragging');
            if (event.clientY < 55) window.scrollBy(0, -20);
            else if (event.clientY > innerHeight - 55) window.scrollBy(0, 20);

            const rect = plane.getBoundingClientRect();
            const width = Math.max(1, rect.width);
            const origins = [...activeDrag.originPositions].map(([slug, position]) => ({
                slug,
                position,
                x: position.x * width / 100,
                y: position.y
            }));
            const minX = Math.min(...origins.map(item => item.x));
            const maxX = Math.max(...origins.map(item => item.x));
            const minY = Math.min(...origins.map(item => item.y));
            const maxY = Math.max(...origins.map(item => item.y));
            const dx = clamp(event.clientX - activeDrag.x, 48 - minX, Math.max(48 - minX, width - 48 - maxX));
            const dy = clamp(event.clientY - activeDrag.y, 68 - minY, Math.max(68 - minY, rect.height - 128 - maxY));

            origins.forEach(item => {
                const x = item.x + dx;
                const y = item.y + dy;
                positions.set(item.slug, { x: x / width * 100, y });
                const coin = plane.querySelector(`[data-coin-slug="${CSS.escape(item.slug)}"]`);
                if (coin) {
                    coin.style.left = x / width * 100 + '%';
                    coin.style.top = y + 'px';
                }
            });
            activeDrag.node.style.pointerEvents = 'none';
            activeDrag.node.style.visibility = 'hidden';

            if (!activeDrag.ghost) {
                activeDrag.ghost = activeDrag.node.cloneNode(true);
                activeDrag.ghost.removeAttribute('data-coin-slug');
                activeDrag.ghost.setAttribute('aria-hidden', 'true');
                activeDrag.ghost.tabIndex = -1;
                activeDrag.ghost.disabled = true;
                activeDrag.ghost.classList.add('manager-coin-ghost');
                activeDrag.ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:2500;transform:translate(-50%,-50%);';
                document.body.append(activeDrag.ghost);
            }
            activeDrag.ghost.style.left = event.clientX + 'px';
            activeDrag.ghost.style.visibility = 'visible';
            activeDrag.ghost.style.top = event.clientY + 'px';
            plane.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));

            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-coin-slug],#manager-coin-unlink');
            hoverLink(activeDrag, target?.dataset.coinSlug && !activeDrag.groupSlugs.includes(target.dataset.coinSlug) && !wanted(target.dataset.coinSlug, activeDrag.slug) ? target : null);
            if (target === el('unlink') && pairStarted && wanted(base, activeDrag.slug) && activeDrag.slug !== base && activeDrag.distance >= 64) {
                target.classList.add('is-drop-target');
            } else if (target?.dataset.coinSlug && target.dataset.coinSlug !== activeDrag.slug && !wanted(target.dataset.coinSlug, activeDrag.slug)) {
                target.classList.add('is-drop-target');
            }
            layoutGroups.forEach(group => {
                const label = [...plane.querySelectorAll('.manager-coin-group-label')].find(node => node.dataset.componentId === group.id);
                if (!label) return;
                const points = group.members.map(slug => positions.get(slug));
                label.style.left = Math.min(...points.map(point => point.x * width / 100 - 46)) + 'px';
                label.style.top = Math.min(...points.map(point => point.y - 78)) + 'px';
            });
            renderLines();
        });

        plane.addEventListener('pointerup', event => {
            if (!drag || drag.id !== event.pointerId) return;

            const activeDrag = drag;
            clearHoverLink(activeDrag);
            const hit = document.elementFromPoint(event.clientX, event.clientY);
            const target = hit?.closest('[data-coin-slug],#manager-coin-unlink') || (plane.contains(hit) ? plane : null);
            const distance = Math.max(activeDrag.distance, Math.hypot(event.clientX - activeDrag.x, event.clientY - activeDrag.y));
            activeDrag.node.style.pointerEvents = '';
            activeDrag.ghost?.remove();
            plane.classList.remove('is-dragging');
            drag = null;
            plane.querySelectorAll('.is-drop-target').forEach(node => node.classList.remove('is-drop-target'));

            if (!activeDrag.moved) {
                return;
            }

            plane.dataset.suppressClick = 'true';
            setTimeout(() => delete plane.dataset.suppressClick, 0);

            const removeLink = target === el('unlink') && pairStarted && distance >= 64 &&
                wanted(base, activeDrag.slug) && activeDrag.slug !== base;
            const targetSlug = target?.dataset.coinSlug;
            const addLink = false; // Drag links require the completed three-second hover.
            if (removeLink || addLink) {
                if (addLink) base = targetSlug;
                targets.clear();
                candidate = activeDrag.slug;
                pairStarted = true;
                stage(base, activeDrag.slug, addLink);
                return;
            }
            if (targetSlug && targetSlug !== activeDrag.slug && wanted(targetSlug, activeDrag.slug)) {
                restoreDragPositions(activeDrag);
                render();
                say(`${card(targetSlug).name} and ${card(activeDrag.slug).name} are already linked. No change staged.`);
                return;
            }

            const rect = plane.getBoundingClientRect();
            const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom;
            const invalidZone = target === el('unlink');
            const movedSlugs = new Set(activeDrag.groupSlugs);
            const overlaps = activeDrag.groupSlugs.some(slug => {
                const position = positions.get(slug);
                return cards.some(item => {
                    if (movedSlugs.has(item.slug)) return false;
                    const other = positions.get(item.slug);
                    return Math.abs((other.x - position.x) * rect.width / 100) < 98 && Math.abs(other.y - position.y) < 122;
                });
            });

            if (!inside || invalidZone || !plane.contains(target) || overlaps) {
                restoreDragPositions(activeDrag);
                say(invalidZone ? 'Choose a first card directly linked to this coin before staging removal. No change staged.' : 'Drop cancelled. Coins stay inside the workspace with room to select them.');
                render();
            } else {
                render();
                say(activeDrag.groupSlugs.length > 1
                    ? 'Linked group moved; no relationship change was staged.'
                    : 'Coin moved within the workspace; no relationship was staged.');
            }
        });

        plane.addEventListener('pointercancel', () => cancel({ restore: true }));
        plane.addEventListener('lostpointercapture', () => cancel({ restore: true }));
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && drag) {
                cancel({ restore: true });
                say('Drag cancelled; the coin returned to its previous position.');
            }
        });

        el('base').addEventListener('change', () => selectMain(el('base').value));
        el('search').addEventListener('input', render);
        el('new-pair')?.addEventListener('click', resetPair);
        function stageTargets(value) {
            const selected = [...targets];
            selected.forEach(slug => stage(base, slug, value));
            targets.clear();
            candidate = '';
            render();
        }
        el('link-selected').addEventListener('click', () => stageTargets(true));
        el('unlink-selected').addEventListener('click', () => stageTargets(false));
        el('clear-pair')?.addEventListener('click', () => {
            targets.clear();
            if (!candidate) return;
            candidate = '';
            render();
            say(`${card(base)?.name || 'First card'} remains selected. Target selection cleared.`);
        });
        el('unlink-all').addEventListener('click', () => {
            const links = cards.filter(item => item.slug !== base && wanted(base, item.slug));
            if (!links.length) return;

            remember();
            for (const item of links) {
                const k = key(base, item.slug);
                if (saved(base, item.slug)) staged.set(k, { value: false, baseSlug: base, otherSlug: item.slug });
                else staged.delete(k);
            }
            arrangeLinkedGroup();
            render();
            say(`Removal of all ${links.length} current links staged. Apply to save.`);
        });
        el('undo').addEventListener('click', () => {
            if (!history.length) return;
            staged = history.pop();
            arrangeLinkedGroup();
            render();
            say('Last staged relationship change undone.');
        });
        el('revert').addEventListener('click', () => {
            staged.clear();
            history = [];
            arrangeLinkedGroup();
            render();
            say('All staged relationship changes discarded.');
        });
        el('apply').addEventListener('click', async () => {
            if (applying || !pending()) return;

            const operations = new Map();
            staged.forEach(change => {
                let operation = operations.get(change.baseSlug);
                if (!operation) {
                    operation = { baseSlug: change.baseSlug, add: [], remove: [] };
                    operations.set(change.baseSlug, operation);
                }
                operation[change.value ? 'add' : 'remove'].push(change.otherSlug);
            });

            applying = true;
            actions();
            say('Saving staged form relationships...');
            try {
                await window.CardAdminCoins.applyPending({ operations: [...operations.values()] });
                staged.clear();
                history = [];
                say('Relationships saved.');
            } catch (error) {
                say(`${error.message} Staged relationships remain available to retry.`);
            } finally {
                applying = false;
                refresh();
            }
        });

        document.addEventListener('card-admin-cards-change', () => {
            if (!applying) refresh();
        });
        window.addEventListener('resize', () => {
            ensurePositions(plane.clientWidth);
            arrangeLinkedGroup();
            render();
        });
        if ('ResizeObserver' in window) {
            let observedWidth = 0;
            const planeObserver = new ResizeObserver(entries => {
                const width = entries[0]?.contentRect.width || 0;
                if (!width || Math.abs(width - observedWidth) < 0.5) return;
                observedWidth = width;
                arrangeLinkedGroup();
                render();
            });
            planeObserver.observe(plane);
        }

        window.ManagerLinkerCoins = {
            stageLink: slug => stage(base, slug, true),
            stageUnlink: slug => stage(base, slug, false),
            selectMain,
            getState: () => ({
                base,
                candidate,
                targets: [...targets],
                pairStarted,
                edges: [...savedEdges],
                staged: [...staged],
                pending: pending(),
                positions: [...positions],
                components: components(),
                visiblePairs: visiblePairs()
            })
        };
        window.addEventListener('beforeunload', event => {
            if (pending()) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
        refresh();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
