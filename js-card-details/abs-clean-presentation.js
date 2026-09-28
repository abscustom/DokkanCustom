/* Permanent ABS.Clean presentation layout, scoped to Clean's own root. */
(function () {
    'use strict';

    const regionClass = 'abs-clean-presentation-layout-region';
    const homes = new Map();
    const cleanEditTargetHomes = new Map();
    let animationFrame = 0;
    let contentObserver = null;
    let measurementTimer = 0;

    function byId(id, root = window.getCardLayoutRoot?.('abs-clean')) {
        if (!root) return null;
        if (root.id === id) return root;
        return window.getCardLayoutElement?.(id, root) ||
            root.querySelector(`[data-card-element="${CSS.escape(id)}"]`) ||
            root.querySelector(`#${CSS.escape(id)}`);
    }

    function isPresentationRegion(node) {
        return Boolean(node?.classList?.contains(regionClass));
    }

    function ensureRegion(parent, id, label) {
        let region = byId(id);
        if (!region) {
            region = document.createElement('section');
            region.id = id;
            region.setAttribute('aria-label', label);
        }
        // Layout CSS uses the region names as classes, while the DOM keeps
        // their IDs for lookup. Apply both on existing and newly made nodes.
        region.classList.add(regionClass, id);
        if (region.parentElement !== parent) parent.appendChild(region);
        return region;
    }

    function rememberHome(node, preferredHome = null) {
        if (!node) return;
        const priorHome = homes.get(node);
        const preferredParent = preferredHome?.parent;
        const preferredIsSafe = preferredParent?.isConnected &&
            preferredParent !== node && !node.contains(preferredParent);
        const priorIsCleanTemporary = isPresentationRegion(priorHome?.parent) ||
            priorHome?.parent?.matches?.('#abs-clean-category-links-column, #abs-clean-links-under-categories-slot, [data-abs-clean-header-lower], [data-abs-clean-header-controls], [data-abs-clean-header-stats]');
        if (preferredIsSafe && (!priorHome || !priorHome.parent?.isConnected || priorIsCleanTemporary)) {
            homes.set(node, { parent: preferredParent, next: preferredHome.next || null, hidden: preferredHome.hidden });
            return;
        }
        if (priorHome || isPresentationRegion(node.parentElement)) return;
        if (node.parentElement) {
            const viewerIdentityHome = node.id === 'abs-clean-identity-icons'
                ? window.__absCleanViewerIdentityHome
                : null;
            homes.set(node, {
                parent: viewerIdentityHome?.parent || node.parentElement,
                next: viewerIdentityHome ? viewerIdentityHome.next : node.nextElementSibling,
                hidden: node.id === 'abs-clean-identity-icons'
                    ? true
                    : node.hidden
            });
        }
    }

    function moveInto(parent, node, preferredHome = null) {
        if (!parent || !node || parent === node || node.contains(parent)) return false;
        if (node.parentElement === parent) return false;
        rememberHome(node, preferredHome);
        parent.appendChild(node);
        return true;
    }

    function orderDirectChildren(parent, nodes) {
        const ordered = nodes.filter(node => node?.parentElement === parent);
        let anchor = null;
        for (let index = ordered.length - 1; index >= 0; index -= 1) {
            const node = ordered[index];
            if (node.nextElementSibling !== anchor) parent.insertBefore(node, anchor);
            anchor = node;
        }
    }

    function ensureDirectChild(parent, selector, className, label) {
        let node = parent?.querySelector(`:scope > ${selector}`);
        if (!node && parent) {
            node = document.createElement('div');
            node.className = className;
            node.setAttribute(label.attribute, label.value);
            parent.appendChild(node);
        }
        return node || null;
    }

    function ensurePresentationChild(parent, selector, className, attribute, value, label) {
        const node = ensureDirectChild(parent, selector, className, { attribute, value });
        if (!node) return null;
        node.classList.add(regionClass);
        node.setAttribute('aria-label', label);
        return node;
    }

    function setCleanEditTarget(node, editType) {
        if (!node) return;
        if (!cleanEditTargetHomes.has(node)) {
            cleanEditTargetHomes.set(node, {
                hadAttribute: node.hasAttribute('data-edit'),
                value: node.getAttribute('data-edit')
            });
        }
        node.setAttribute('data-edit', editType);
    }

    function ensureCategoryLinkPanel(row, box, kind, label, editType) {
        if (!row || !box) return null;
        let panel = row.querySelector(`:scope > [data-abs-clean-category-link-panel="${kind}"]`);
        if (!panel) {
            panel = document.createElement('section');
            panel.className = `abs-clean-category-link-panel ${regionClass}`;
            panel.dataset.absCleanCategoryLinkPanel = kind;
            panel.setAttribute('aria-label', label);
            row.appendChild(panel);
        }

        let headingSlot = panel.querySelector(':scope > [data-abs-clean-floating-heading-slot]');
        if (!headingSlot) {
            headingSlot = document.createElement('div');
            headingSlot.className = `abs-clean-category-link-heading-slot ${regionClass}`;
            headingSlot.dataset.absCleanFloatingHeadingSlot = kind;
            panel.appendChild(headingSlot);
        }

        const header = box.querySelector(':scope > .abs-header');
        if (header) {
            header.dataset.absCleanFloatingHeading = kind;
            setCleanEditTarget(header, editType);
            moveInto(headingSlot, header);
        }
        return panel;
    }

    function restoreCleanEditTargets() {
        for (const [node, original] of cleanEditTargetHomes) {
            if (!node) continue;
            if (original.hadAttribute) node.setAttribute('data-edit', original.value ?? '');
            else node.removeAttribute('data-edit');
        }
        cleanEditTargetHomes.clear();
    }

    function ensureCharacterHeaderGroups(layout, header) {
        if (!layout || !header) return null;
        const bar = layout.querySelector('[data-abs-clean-character-header-bar]') || ensurePresentationChild(
            layout,
            '[data-abs-clean-character-header-bar]',
            'abs-clean-character-header-bar',
            'data-abs-clean-character-header-bar',
            'true',
            'Character name and passive summary'
        );
        if (!bar) return null;
        bar.classList.add(regionClass);
        bar.setAttribute('aria-label', 'Character name and passive summary');

        const badgeGroup = layout.querySelector('[data-abs-clean-header-badge-group]') ||
            ensurePresentationChild(bar, '[data-abs-clean-header-badge-group]', 'abs-clean-header-badge-group', 'data-abs-clean-header-badge-group', 'true', 'Passive Skill badges');
        const nameGroup = ensurePresentationChild(bar, '[data-abs-clean-header-name]', 'abs-clean-header-main-name', 'data-abs-clean-header-name', 'true', 'Character name and release date');
        const totalGroup = ensurePresentationChild(bar, '[data-abs-clean-header-total-group]', 'abs-clean-header-total-group', 'data-abs-clean-header-total-group', 'true', 'Passive percentage totals');
        const formDock = ensurePresentationChild(bar, '[data-abs-clean-header-form-dock]', 'abs-clean-header-form-dock', 'data-abs-clean-header-form-dock', 'true', 'Character form selection');
        const nameDetails = ensurePresentationChild(
            nameGroup,
            '[data-abs-clean-header-name-details]',
            'abs-clean-header-name-details',
            'data-abs-clean-header-name-details',
            'true',
            'Character name and release date'
        );
        badgeGroup?.setAttribute('role', 'group');
        badgeGroup?.setAttribute('data-edit', 'passive');
        nameGroup?.setAttribute('role', 'group');
        nameDetails?.setAttribute('role', 'group');
        totalGroup?.setAttribute('role', 'group');
        totalGroup?.setAttribute('data-edit', 'passive');
        formDock?.setAttribute('role', 'group');

        bar.hidden = false;
        // The visual bar now participates in the single consolidated header
        // row. Keep it where syncCompactHeader placed it instead of pulling
        // the name and totals back above the lower header on every pass.
        if (bar.parentElement === layout && bar.nextElementSibling !== header) layout.insertBefore(bar, header);
        return { bar, badgeGroup, nameGroup, nameDetails, totalGroup, formDock };
    }

    function syncCompactHeader(layout, header, headerLeft, statsBox, characterGroups) {
        if (!header || !headerLeft) return;

        // This stack is deliberately moved into the name group below. Search
        // the whole Clean layout before creating it so subsequent syncs reuse
        // the moved node instead of appending another wrapper on every pass.
        const portraitStack = layout.querySelector('[data-abs-clean-portrait-stack]') ||
            ensurePresentationChild(
                layout,
                '[data-abs-clean-portrait-stack]',
                'abs-clean-header-portrait-stack',
                'data-abs-clean-portrait-stack',
                'true',
                'Character portrait'
            );
        const headerLower = layout.querySelector('[data-abs-clean-header-lower]') ||
            ensurePresentationChild(header, '[data-abs-clean-header-lower]', 'abs-clean-header-lower', 'data-abs-clean-header-lower', 'true', 'Stats, passive badges, and forms');
        const statsLane = layout.querySelector('[data-abs-clean-header-stats]') ||
            ensurePresentationChild(header, '[data-abs-clean-header-stats]', 'abs-clean-header-stats-lane', 'data-abs-clean-header-stats', 'true', 'Character stats');
        const awakeningGroup = layout.querySelector('[data-abs-clean-header-awakening-group]') ||
            ensurePresentationChild(characterGroups?.bar, '[data-abs-clean-header-awakening-group]', 'abs-clean-header-awakening-group', 'data-abs-clean-header-awakening-group', 'true', 'Awakening progression');
        const legacyRightDock = layout.querySelector('[data-abs-clean-header-side-dock]');
        // Like the portrait stack, controls move out of the source header.
        // Reuse the moved region from the Clean layout on every later sync.
        let controls = layout.querySelector('[data-abs-clean-header-controls]');
        if (!controls) {
            controls = ensurePresentationChild(
                headerLower,
                '[data-abs-clean-header-controls]',
                'abs-clean-header-controls',
                'data-abs-clean-header-controls',
                'true',
                'Awakening and form controls'
            );
        } else {
            controls.classList.add(regionClass);
            controls.setAttribute('aria-label', 'Awakening and form controls');
        }

        portraitStack.hidden = false;
        headerLower.hidden = false;
        controls.hidden = true;
        moveInto(headerLower, characterGroups?.bar);
        moveInto(characterGroups?.bar, portraitStack);
        moveInto(characterGroups?.bar, characterGroups?.totalGroup);

        const composedIcon = byId('abs-composed-icon', layout);
        moveInto(characterGroups?.bar, characterGroups?.nameGroup);
        moveInto(portraitStack, composedIcon);
        moveInto(characterGroups?.nameDetails || characterGroups?.nameGroup, byId('abs-char-name', layout));
        setCleanEditTarget(composedIcon, 'art');
        moveInto(statsLane, statsBox, window.__absCleanStatsHome || window.__absCleanStatsPlacementHome);
        const potentialSlider = statsBox?.querySelector('[data-card-element="abs-stat-range-slider"]');
        if (potentialSlider && !potentialSlider.hasAttribute('aria-label')) {
            potentialSlider.setAttribute('aria-label', 'Hidden Potential');
        }

        // Reuse the live form rows as portrait miniatures. Their original
        // anchors and editor data attributes remain intact, so viewer links
        // still navigate and editor rows still open the form editor.
        const awakeningPortraits = byId('abs-clean-awakening-portraits', layout);
        const ezaToggle = byId('abs-eza-toggle-bar', layout);
        const formsPanel = byId('abs-clean-awakening-forms-box', layout);
        const transformationsContainer = byId('abs-transformations-container', layout);
        if (awakeningPortraits && !awakeningPortraits.dataset.cardElement) awakeningPortraits.dataset.cardElement = 'abs-clean-awakening-portraits';
        if (ezaToggle && !ezaToggle.dataset.cardElement) ezaToggle.dataset.cardElement = 'abs-eza-toggle-bar';
        if (formsPanel && !formsPanel.dataset.cardElement) formsPanel.dataset.cardElement = 'abs-clean-awakening-forms-box';
        moveInto(awakeningGroup, awakeningPortraits);
        moveInto(characterGroups?.formDock, ezaToggle);
        if (characterGroups?.formDock) {
            characterGroups.formDock.hidden = !ezaToggle || ezaToggle.hidden || ezaToggle.style.display === 'none';
        }
        moveInto(portraitStack, transformationsContainer);
        if (transformationsContainer) {
            const miniatureCount = Array.from(transformationsContainer.querySelectorAll(':scope > .abs-transform-row'))
                .filter(row => !row.classList.contains('abs-clean-current-form')).length;
            transformationsContainer.hidden = miniatureCount === 0;
        }
        if (formsPanel) formsPanel.hidden = true;
        if (legacyRightDock && legacyRightDock !== headerLower) {
            Array.from(legacyRightDock.children).forEach(child => moveInto(characterGroups?.bar, child));
            legacyRightDock.remove();
        }
        orderDirectChildren(portraitStack, [composedIcon, transformationsContainer]);
        orderDirectChildren(characterGroups?.bar, [portraitStack, characterGroups?.nameGroup, awakeningGroup, characterGroups?.totalGroup, characterGroups?.formDock]);
        orderDirectChildren(characterGroups?.nameGroup, [characterGroups?.nameDetails, characterGroups?.badgeGroup]);
        orderDirectChildren(awakeningGroup, [awakeningPortraits]);
        orderDirectChildren(statsLane, [statsBox]);
        orderDirectChildren(headerLower, [characterGroups?.bar]);
        statsLane.hidden = !statsBox;
        // Do not infer availability from computed display under a hidden
        // ancestor. The stage renderers own each portrait's hidden state.
        awakeningGroup.hidden = !awakeningPortraits?.querySelector('.abs-clean-awakening-portrait:not([hidden])');
        characterGroups.badgeGroup.hidden = !byId('abs-clean-ability-docks', layout) || byId('abs-clean-ability-docks', layout).hidden;
        controls.hidden = true;
        if (legacyRightDock?.isConnected) legacyRightDock.remove();

        orderDirectChildren(headerLeft, [
            byId('abs-clean-type-matchups', layout)
        ]);
    }

    function syncArtworkPresentation(layout, artDock, characterGroups) {
        if (!artDock) return;
        const artworkColumn = artDock.parentElement;
        if (!artworkColumn) return;

        let meta = artworkColumn.querySelector(':scope > [data-abs-clean-artwork-meta]') ||
            artDock.querySelector(':scope > [data-abs-clean-artwork-meta]');
        if (!meta) {
            meta = document.createElement('div');
            meta.className = 'abs-clean-presentation-artwork-meta';
            meta.dataset.absCleanArtworkMeta = 'true';
        }
        meta.classList.add(regionClass);
        meta.setAttribute('aria-label', 'Character title and identity');

        if (meta.parentElement !== artworkColumn) artworkColumn.insertBefore(meta, artDock);
        else if (meta.nextElementSibling !== artDock) artworkColumn.insertBefore(meta, artDock);
        if (!meta) return;
        meta.hidden = false;

        const title = byId('abs-char-title', layout);
        const identity = byId('abs-clean-identity-icons', layout);
        const artHeader = byId('abs-art-header-bar', layout);
        const releaseDate = byId('abs-clean-release-date', layout);
        const artToggle = byId('abs-art-toggle-bar', layout);
        const tagBadge = byId('abs-clean-badge-tag', layout);
        const tagValue = tagBadge?.querySelector('.abs-clean-badge-val')?.textContent?.trim() || '';
        const artHeaderText = artHeader?.querySelector('[data-card-element="abs-art-header-text"], #clean-abs-art-header-text, #abs-art-header-text');
        let artHeaderValue = artHeaderText?.textContent?.trim() || artHeader?.textContent?.trim() || '';
        if (artHeader) {
            if (!artHeader.dataset.cardElement) artHeader.dataset.cardElement = 'abs-art-header-bar';
            if (!artHeaderValue && tagValue) {
                if (artHeaderText) artHeaderText.textContent = tagValue;
                artHeaderValue = tagValue;
            }
            artHeader.hidden = !artHeaderValue;
            setCleanEditTarget(artHeader, 'art');
        }
        // The unit classification gets its own floating badge below the title.
        // Keep the source text in the identity node, but avoid showing it twice.
        if (tagBadge) tagBadge.hidden = Boolean(artHeaderValue);

        if (releaseDate && !releaseDate.dataset.cardElement) releaseDate.dataset.cardElement = 'abs-clean-release-date';
        if (identity) {
            if (!identity.dataset.cardElement) identity.dataset.cardElement = 'abs-clean-identity-icons';
            identity.hidden = false;
            const classBadge = byId('abs-clean-badge-class', layout);
            const activeClass = window.getCardIdentityState?.()?.cardClass || window.currentClass || 'super';
            if (classBadge) classBadge.dataset.cardClass = String(activeClass).toLowerCase();
        }
        const cardType = byId('abs-clean-val-type', layout)?.textContent?.trim().toLowerCase();
        if (cardType && meta) meta.dataset.cardType = cardType;
        if (cardType && characterGroups?.bar) characterGroups.bar.dataset.cardType = cardType;
        if (releaseDate && !releaseDate.dataset.cardElement) releaseDate.dataset.cardElement = 'abs-clean-release-date';
        const nameDetails = characterGroups?.nameDetails || characterGroups?.nameGroup;
        moveInto(nameDetails, title);
        if (title) title.hidden = !title.textContent?.trim();
        moveInto(meta, identity);
        moveInto(meta, artHeader);
        moveInto(nameDetails, releaseDate);
        if (releaseDate) releaseDate.hidden = !releaseDate.textContent?.trim();
        if (nameDetails) {
            orderDirectChildren(nameDetails, [title, byId('abs-char-name', layout), releaseDate]);
        }
        // Clear the old runtime-only artwork release wrapper after moving its
        // live release-date node into the character-name group.
        layout.querySelectorAll('[data-abs-clean-artwork-release]')
            .forEach(oldReleaseRow => oldReleaseRow.remove());

        orderDirectChildren(meta, [artHeader, identity]);
        return { meta };
    }

    function syncArtworkCenterline(layout, artDock, characterGroups) {
        if (!layout || !artDock) return;
        const artwork = byId('abs-art-layers-container', layout) || artDock;
        const artworkRect = artwork.getBoundingClientRect();
        const targetCenter = artworkRect.left + artworkRect.width / 2;
        if (!Number.isFinite(targetCenter)) return;

        layout.style.setProperty('--abs-clean-artwork-column-width', `${artworkRect.width}px`);

        const translationX = element => {
            const transform = window.getComputedStyle(element).transform;
            if (!transform || transform === 'none') return 0;
            try {
                if (typeof DOMMatrixReadOnly === 'function') return new DOMMatrixReadOnly(transform).m41;
            } catch { /* use the matrix fallback below */ }
            const values = transform.match(/matrix(?:3d)?\(([^)]+)\)/)?.[1]
                .split(',').map(value => Number.parseFloat(value.trim()));
            return values?.length === 16 ? values[12] : values?.length === 6 ? values[4] : 0;
        };

        const alignCenter = (element, property) => {
            if (!element || element.hidden || window.getComputedStyle(element).display === 'none') return;
            const rect = element.getBoundingClientRect();
            const currentCenter = rect.left + rect.width / 2;
            const currentTranslation = translationX(element);
            const correction = currentTranslation + targetCenter - currentCenter;
            if (Number.isFinite(correction)) layout.style.setProperty(property, `${correction}px`);
        };

        // The character identity now sits in the transparent left-to-right
        // header row; it must not be translated toward the artwork centerline.
        layout.style.removeProperty('--abs-clean-name-centerline-correction');
        layout.style.removeProperty('--abs-clean-leader-label-centerline-correction');
        const leaderBox = byId('clean-abs-leader-skill-box', layout);
        alignCenter(leaderBox?.querySelector(':scope > .abs-header'), '--abs-clean-leader-header-centerline-correction');
        alignCenter(byId('clean-abs-leader-skill', layout), '--abs-clean-leader-description-centerline-correction');
    }

    function syncPassiveSummaryBar(layout, passiveBox, characterGroups) {
        if (!passiveBox || !characterGroups?.bar) return;
        const docks = byId('abs-clean-ability-docks', layout);
        const summary = byId('abs-passive-summary', layout);
        const { bar, badgeGroup, nameGroup, nameDetails, totalGroup, formDock } = characterGroups;
        const characterName = byId('abs-char-name', layout);
        const nameDestination = nameDetails || nameGroup;
        setCleanEditTarget(nameDestination, 'identity');
        moveInto(nameDestination, characterName);
        const releaseDate = byId('abs-clean-release-date', layout);
        const title = byId('abs-char-title', layout);
        moveInto(nameDestination, title);
        orderDirectChildren(nameDestination, [title, characterName, releaseDate]);
        moveInto(badgeGroup, docks, window.__absCleanAbilityDocksHome);
        moveInto(nameGroup, badgeGroup);
        moveInto(totalGroup, summary, window.__absCleanPassiveSummaryHome);

        badgeGroup.hidden = !docks || docks.hidden;
        totalGroup.hidden = !summary || summary.hidden;
        nameGroup.hidden = !characterName;
        bar.hidden = !characterName && badgeGroup.hidden && totalGroup.hidden && (!formDock || formDock.hidden);
        const portraitStack = layout.querySelector('[data-abs-clean-portrait-stack]');
        const awakeningGroup = layout.querySelector('[data-abs-clean-header-awakening-group]');
        orderDirectChildren(nameGroup, [layout.querySelector('[data-abs-clean-header-name-details]'), badgeGroup]);
        orderDirectChildren(bar, [portraitStack, nameGroup, totalGroup, awakeningGroup, formDock]);

        // Remove the previous single summary wrapper after its live contents
        // have moved into the two separately labelled bar groups.
        layout.querySelectorAll('[data-abs-clean-header-passive-summary]')
            .forEach(oldPanel => oldPanel.remove());
        // The Passive Skill title and effect description stay together below.
        passiveBox.querySelectorAll(':scope > [data-abs-clean-passive-summary-panel]')
            .forEach(oldPanel => oldPanel.remove());
    }

    function restorePresentationChildren(layout, mainCol, sideCol) {
        for (const [node, home] of homes) {
            if (!isPresentationRegion(node.parentElement)) continue;
            const fallback = node.id === 'abs-clean-leader-banner-slot' ||
                node.id === 'abs-sa-container' ||
                node.id === 'abs-clean-active-domain-row' ||
                node.id === 'abs-clean-right-rail' ||
                node.id === 'abs-passive-skill-box' ||
                node.id === 'abs-categories-box'
                ? mainCol
                : node.id === 'abs-stats-box' || node.id === 'abs-clean-awakening-forms-box'
                    ? sideCol
                    : node.id === 'abs-link-skills-box'
                        ? byId('abs-link-skills-legacy-slot', layout) || mainCol
                : null;
            const parent = home.parent?.isConnected ? home.parent : fallback;
            if (!parent || parent === node || node.contains(parent)) continue;
            const anchor = home.next?.parentElement === parent &&
                home.next !== node &&
                !node.contains(home.next)
                ? home.next
                : null;
            parent.insertBefore(node, anchor);
            if (node.id === 'abs-clean-identity-icons') {
                node.classList.remove('abs-clean-header-identity');
                node.hidden = true;
            } else if (home.hidden !== undefined) {
                node.hidden = home.hidden;
            }
        }

        const controls = layout?.querySelector('[data-abs-clean-header-controls]');
        if (controls) controls.hidden = true;
        const statsLane = layout?.querySelector('[data-abs-clean-header-stats]');
        if (statsLane) statsLane.hidden = true;
        const headerLower = layout?.querySelector('[data-abs-clean-header-lower]');
        if (headerLower) headerLower.hidden = true;

        layout?.querySelectorAll('[data-abs-clean-portrait-stack], [data-abs-clean-header-name], [data-abs-clean-artwork-meta], [data-abs-clean-artwork-release]')
            .forEach(region => { region.hidden = true; });
        layout?.querySelectorAll('[data-abs-clean-passive-summary-panel], [data-abs-clean-header-passive-summary]')
            .forEach(panel => { panel.hidden = true; });
        const characterHeaderBar = layout?.querySelector('[data-abs-clean-character-header-bar]');
        if (characterHeaderBar) {
            const badgeGroup = layout?.querySelector('[data-abs-clean-header-badge-group]');
            if (badgeGroup && badgeGroup.parentElement !== characterHeaderBar) characterHeaderBar.prepend(badgeGroup);
            characterHeaderBar.hidden = true;
        }
        layout?.querySelector('[data-abs-clean-active-category-link-row]')?.setAttribute('hidden', '');
        layout?.querySelectorAll('[data-abs-clean-category-link-panel]')
            .forEach(panel => panel.remove());
        restoreCleanEditTargets();
    }

    function syncAbsCleanPresentationLayout() {
        const layout = window.getCardLayoutRoot?.('abs-clean') || document.getElementById('layout-abs-clean');
        const grid = layout?.querySelector('.abs-grid-container');
        const mainCol = grid?.querySelector(':scope > .abs-main-col');
        const sideCol = grid?.querySelector(':scope > .abs-side-col');
        if (!layout || !grid || !mainCol || !sideCol) return;

        if (!document.body?.classList.contains('theme-abs-clean')) {
            if (layout.classList.contains('abs-clean-presentation-active')) {
                restorePresentationChildren(layout, mainCol, sideCol);
                layout.classList.remove('abs-clean-presentation-active');
            }
            [
                '--abs-clean-artwork-column-width',
                '--abs-clean-portrait-centerline-correction',
                '--abs-clean-name-centerline-correction',
                '--abs-clean-leader-header-centerline-correction',
                '--abs-clean-leader-label-centerline-correction',
                '--abs-clean-leader-description-centerline-correction'
            ].forEach(property => layout.style.removeProperty(property));
            grid.querySelector(':scope > #abs-clean-presentation-title')?.remove();
            return;
        }

        layout.classList.add('abs-clean-presentation-active');

        const leaderRegion = ensureRegion(mainCol, 'abs-clean-presentation-leader', 'Leader Skill');
        const attacksRegion = ensureRegion(mainCol, 'abs-clean-presentation-attacks', 'Super Attacks and related skills');
        const passiveRegion = ensureRegion(mainCol, 'abs-clean-presentation-passive', 'Passive Skill');
        const header = layout.querySelector(':scope > .abs-top-header');
        const headerLeft = header?.querySelector('.abs-header-left');
        const characterGroups = ensureCharacterHeaderGroups(layout, header);

        moveInto(leaderRegion, byId('abs-clean-leader-banner-slot', layout));

        const activeDomainRow = byId('abs-clean-active-domain-row', layout);
        const rightRail = byId('abs-clean-right-rail', layout);
        const saContainer = byId('abs-sa-container', layout);
        const activeCategoryLinkRow = ensurePresentationChild(
            attacksRegion,
            '[data-abs-clean-active-category-link-row]',
            'abs-clean-active-category-link-row',
            'data-abs-clean-active-category-link-row',
            'true',
            'Categories and Link Skills'
        );
        moveInto(attacksRegion, saContainer);
        if (activeDomainRow) {
            moveInto(attacksRegion, activeDomainRow);
        } else {
            ['abs-active-container', 'abs-field-container', 'abs-standby-container', 'abs-finish-container']
                .forEach(id => moveInto(attacksRegion, byId(id, layout)));
        }
        moveInto(attacksRegion, rightRail);

        moveInto(passiveRegion, byId('abs-passive-skill-box', layout));

        const categoryLinksColumn = byId('abs-clean-category-links-column', layout);
        const categoryBox = byId('abs-categories-box', layout) ||
            byId('abs-category-container', layout)?.closest('.abs-box');
        const linkSkillsBox = byId('abs-link-skills-box', layout);
        const linkSlot = byId('abs-clean-links-under-categories-slot', layout) ||
            byId('abs-link-skills-legacy-slot', layout);
        const partnersRow = byId('abs-clean-link-partners-row', layout);
        const partnersBox = byId('abs-partners-box', layout);
        const statsBox = byId('abs-stats-box', layout);

        syncCompactHeader(layout, header, headerLeft, statsBox, characterGroups);
        const artDock = byId('abs-art-dock-wrapper', layout);
        const artworkPresentation = syncArtworkPresentation(layout, artDock, characterGroups);

        const categoryHome = window.__absCleanCategoryLinksHome;
        const linkHome = window.__absCleanLinkPartnersHome?.link;
        const categoryPanel = ensureCategoryLinkPanel(activeCategoryLinkRow, categoryBox, 'categories', 'Categories', 'categories');
        const linkPanel = ensureCategoryLinkPanel(activeCategoryLinkRow, linkSkillsBox, 'links', 'Link Skills', 'links');
        moveInto(categoryPanel, categoryBox, categoryHome);
        moveInto(linkPanel, linkSkillsBox, linkHome || (linkSlot ? { parent: linkSlot, next: null } : null));
        orderDirectChildren(activeCategoryLinkRow, [categoryPanel, linkPanel]);
        activeCategoryLinkRow.hidden = !categoryBox && !linkSkillsBox;
        if (categoryLinksColumn) {
            const emptyLinkSlot = categoryLinksColumn.querySelector('#abs-clean-links-under-categories-slot');
            if (emptyLinkSlot && !emptyLinkSlot.children.length) emptyLinkSlot.remove();
            if (!categoryLinksColumn.children.length) categoryLinksColumn.remove();
            else categoryLinksColumn.hidden = true;
        }
        // Keep Categories and Link Skills after every skill family so the
        // paired panels sit beneath Active Skills when that row is present.
        const statsLane = layout.querySelector('[data-abs-clean-header-stats]');
        moveInto(sideCol, statsLane);
        orderDirectChildren(attacksRegion, [saContainer, activeDomainRow, rightRail, activeCategoryLinkRow]);
        moveInto(sideCol, partnersRow);
        if (!partnersRow) moveInto(sideCol, partnersBox);
        syncPassiveSummaryBar(layout, byId('abs-passive-skill-box', layout), characterGroups);

        const centerOrder = [
            byId('abs-clean-portrait-stage', layout),
            artworkPresentation?.meta,
            artDock,
            statsLane,
            byId('abs-clean-bottom-timeline', layout),
            byId('abs-motion-box', layout),
            byId('abs-awakenings-box', layout),
            byId('abs-transformations-box', layout),
            partnersRow,
            partnersBox
        ];
        orderDirectChildren(sideCol, centerOrder);
        syncArtworkCenterline(layout, artDock, characterGroups);
        syncOverflowNames(layout);
        // Our own reparenting and text wrappers are already reconciled.
        // Do not schedule a second structural pass for those mutations.
        contentObserver?.takeRecords();
    }

    // Measure only live text. A wrapping span keeps each item's dimensions
    // fixed while the full name moves inside it; data and click targets stay put.
    const nameResizeObserver = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => scheduleMeasurements()) : null;
    const observedNames = new Set();
    function syncOverflowNames(layout) {
        for (const node of observedNames) {
            if (node.isConnected) continue;
            nameResizeObserver?.unobserve(node);
            observedNames.delete(node);
        }
        const observe = node => {
            if (!node || observedNames.has(node)) return;
            observedNames.add(node);
            nameResizeObserver?.observe(node);
        };
        const names = Array.from(layout.querySelectorAll('.abs-category-name, .abs-link-name, [data-card-element="abs-char-name"], #clean-abs-char-name'));
        // Prepare wrappers first, then read every size, then write styles.
        // Interleaving these operations forced a layout for every category.
        const prepared = names.map(node => {
            let text = node.querySelector(':scope > .abs-clean-scrolling-text');
            if (!text) {
                const name = node.textContent.trim();
                if (!name) return null;
                text = document.createElement('span');
                text.className = 'abs-clean-scrolling-text';
                text.textContent = name;
                node.replaceChildren(text);
            }
            const fullName = text.textContent.trim();
            if (node.title !== fullName) node.title = fullName;
            if (node.getAttribute('aria-label') !== fullName) node.setAttribute('aria-label', fullName);
            if (node.classList.contains('abs-category-name')) {
                const category = node.closest('.abs-category-badge');
                if (category && category.getAttribute('data-tooltip') !== fullName) category.setAttribute('data-tooltip', fullName);
            }
            node.classList.add('abs-clean-name-viewport');
            observe(node);
            return {node, text};
        }).filter(Boolean);
        const headers = Array.from(layout.querySelectorAll('.abs-sa-floating-header')).map(header => {
            const footer = header.parentElement.querySelector(':scope > .abs-sa-floating-footer');
            observe(header); observe(footer);
            return {parent: header.parentElement, height: header.offsetHeight, footerHeight: footer?.offsetHeight || 0};
        });
        const measurements = prepared.map(({node, text}) => ({node, distance: Math.max(0, text.scrollWidth - node.clientWidth)}));
        const setProperty = (node, name, value) => {
            if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
        };
        headers.forEach(({parent, height, footerHeight}) => {
            setProperty(parent, '--abs-clean-floating-height', height + 'px');
            setProperty(parent, '--abs-clean-footer-height', footerHeight + 'px');
        });
        measurements.forEach(({node, distance}) => {
            node.classList.toggle('abs-clean-name-overflow', distance > 1);
            setProperty(node, '--abs-clean-name-travel', -distance + 'px');
            setProperty(node, '--abs-clean-name-duration', Math.max(5, distance / 22 + 3) + 's');
            if (distance > 1) { if (node.getAttribute('tabindex') !== '0') node.setAttribute('tabindex', '0'); }
            else if (node.hasAttribute('tabindex')) node.removeAttribute('tabindex');
        });
    }

    function scheduleSync() {
        if (animationFrame) return;
        animationFrame = window.requestAnimationFrame(() => {
            animationFrame = 0;
            syncAbsCleanPresentationLayout();
        });
    }

    function scheduleMeasurements() {
        if (!document.body.classList.contains('theme-abs-clean')) return;
        clearTimeout(measurementTimer);
        measurementTimer = setTimeout(() => {
            measurementTimer = 0;
            if (!document.body.classList.contains('theme-abs-clean')) return;
            const layout = window.getCardLayoutRoot?.('abs-clean') || document.getElementById('layout-abs-clean');
            if (!layout) return;
            syncArtworkCenterline(layout, byId('abs-art-dock-wrapper', layout));
            syncOverflowNames(layout);
            contentObserver?.takeRecords();
        }, 100);
    }

    window.syncAbsCleanPresentationLayout = syncAbsCleanPresentationLayout;

    const layoutRoot = window.getCardLayoutRoot?.('abs-clean') || document.getElementById('layout-abs-clean');
    if (layoutRoot && typeof MutationObserver === 'function') {
        contentObserver = new MutationObserver(records => {
            if (!document.body.classList.contains('theme-abs-clean')) return;
            const affectsPresentationLayout = records.some(record => {
                const target = record.target.nodeType === Node.ELEMENT_NODE
                    ? record.target
                    : record.target.parentElement;
                // Passive-name typing updates only these labels directly; it
                // does not change Clean's structural placement or measurements.
                return !target?.closest('.passive-name-display, .abs-passive-name-inside, [data-card-element="abs-passive-container"], #abs-passive-container');
            });
            if (affectsPresentationLayout) scheduleSync();
        });
        contentObserver.observe(layoutRoot, { childList: true, characterData: true, subtree: true });

        let wasClean = document.body.classList.contains('theme-abs-clean');
        const themeObserver = new MutationObserver(() => {
            const isClean = document.body.classList.contains('theme-abs-clean');
            if (isClean === wasClean) return;
            wasClean = isClean;
            scheduleSync();
        });
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('abs-clean-theme-visible', scheduleSync);
    window.addEventListener('abs-card-content-ready', scheduleSync);
    window.addEventListener('resize', scheduleMeasurements, { passive: true });
    document.fonts?.ready.then(scheduleMeasurements);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleSync, { once: true });
    } else {
        scheduleSync();
    }
})();
