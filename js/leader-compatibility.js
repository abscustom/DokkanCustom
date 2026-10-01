(() => {
    'use strict';

    const DATA_URLS = {
        cards: 'json/cards.json',
        leaders: 'json/leader_skills.json',
        categories: 'json/card_categories.json',
        routes: 'json/awakening_routes.json'
    };
    const TYPE_NAMES = ['AGL', 'TEQ', 'INT', 'STR', 'PHY'];
    const TYPE_COLORS = {
        AGL: '#67a8ff',
        TEQ: '#35d178',
        INT: '#c78bff',
        STR: '#ff6977',
        PHY: '#ffc54d'
    };
    const PAGE_SIZE = 85;
    const PICKER_ID = 'lc-leader-picker';
    const SELECTED_LEADER_STORAGE_KEY = 'leader-compatibility-selected-leader';
    const PICKER_GRID_ID = 'unitPickerGrid';
    const FALLBACK_PORTRAIT_URL = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#30435e"/><stop offset="1" stop-color="#111b2c"/></linearGradient></defs><rect width="250" height="250" fill="url(#g)"/><circle cx="125" cy="88" r="43" fill="#7d8ba0"/><path d="M37 250c6-62 37-92 88-92s82 30 88 92" fill="#7d8ba0"/></svg>')}`;

    const elements = {
        pickerOpen: document.getElementById('lc-picker-open'),
        pickerOpenFallback: document.getElementById('lc-picker-open-fallback'),
        dataStatus: document.getElementById('lc-data-status'),
        selectedPanel: document.getElementById('lc-selected-leader'),
        leaderPortrait: document.getElementById('lc-leader-portrait'),
        leaderType: document.getElementById('lc-leader-type'),
        leaderName: document.getElementById('lc-selected-name'),
        leaderSkillName: document.getElementById('lc-leader-skill-name'),
        leaderDescription: document.getElementById('lc-leader-description'),
        leaderNote: document.getElementById('lc-leader-note'),
        resultsToolbar: document.getElementById('lc-results-toolbar'),
        resultsSection: document.getElementById('lc-results-section'),
        resultsSummary: document.getElementById('lc-results-summary'),
        unitSearch: document.getElementById('lc-unit-search'),
        unitsGrid: document.getElementById('lc-units-grid'),
        emptyState: document.getElementById('lc-empty-state'),
        loadMoreWrap: document.getElementById('lc-load-more-wrap'),
        loadMore: document.getElementById('lc-load-more'),
        page: document.getElementById('leader-compatibility-page'),
        presentationButtons: Array.from(document.querySelectorAll('[data-card-presentation-option]'))
    };

    const PRESENTATION_STORAGE_KEY = 'leader-compatibility-presentation';
    try {
        const savedPresentation = window.localStorage.getItem(PRESENTATION_STORAGE_KEY);
        if (savedPresentation === 'abs' || savedPresentation === 'dokkan') {
            elements.page.dataset.cardPresentation = savedPresentation;
        }
    } catch {
        // Keep the ABS default from the page markup when storage is unavailable.
    }

    const state = {
        cards: [],
        allLeaderCards: [],
        leadersById: new Map(),
        categories: [],
        routeReleaseDates: new Map(),
        leaderCards: [],
        selectedCard: null,
        parsedSkill: null,
        results: [],
        matchFilter: 'all',
        unitSearch: '',
        visibleCount: PAGE_SIZE,
        autoPickerAttempted: false
    };

    function folderIdForCard(cardId) {
        let rawId = Number.parseInt(cardId, 10) || 0;
        if (rawId > 10000000) rawId = Math.floor(rawId / 10);
        return Math.floor(rawId / 10) * 10;
    }

    function typeInfo(elementId) {
        const raw = Number.parseInt(elementId, 10) || 0;
        const alignment = Math.floor(raw / 10);
        const typeIndex = raw % 10;
        const type = TYPE_NAMES[typeIndex] || '';
        return {
            type,
            cardClass: alignment === 2 ? 'extreme' : 'super',
            label: type ? `${alignment === 2 ? 'Extreme' : 'Super'} ${type}` : 'Type unavailable',
            color: TYPE_COLORS[type] || '#9aaac0',
            code: String(raw).padStart(2, '0')
        };
    }

    function safeImage(card, className, alt = '', circular = false) {
        const image = document.createElement('img');
        image.className = className;
        image.alt = alt;
        image.loading = 'lazy';
        image.decoding = 'async';
        const folderId = folderIdForCard(card.id);
        const parentFolderId = folderIdForCard(normalizedCardReferenceId(card.id));
        const fallbackUrls = [folderId, parentFolderId]
            .filter((id, index, ids) => ids.indexOf(id) === index)
            .map((id) => `https://images.weserv.nl/?url=dokkaninfo.com/assets/japan/character/thumb/card_${id}_thumb/card_${id}_thumb.png`);
        fallbackUrls.push('https://abscustom.github.io/assets/images/SSR_Icon.png', FALLBACK_PORTRAIT_URL);
        const thumbnailUrl = new URL(`assets/card-art/thumbnails/card_${folderId}_thumb/card_${folderId}_thumb.png`, document.baseURI).href;
        if (circular) fallbackUrls.unshift(thumbnailUrl);
        let fallbackIndex = 0;
        image.src = circular
            ? new URL(`assets/card-art/cards/${folderId}/card_${folderId}_circle.png`, document.baseURI).href
            : thumbnailUrl;
        image.addEventListener('error', () => {
            const fallbackUrl = fallbackUrls[fallbackIndex++];
            if (fallbackUrl) {
                image.src = fallbackUrl;
                return;
            }
            image.removeAttribute('src');
            image.classList.add('is-missing');
            image.setAttribute('aria-hidden', 'true');
        });
        return image;
    }

    function normalizeText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizedCardReferenceId(value) {
        let rawId = Number.parseInt(value, 10) || 0;
        if (rawId > 10000000) rawId = Math.floor(rawId / 10);
        const rawText = String(rawId);
        if (rawText.length === 7 && rawText.startsWith('4')) {
            rawId = Number.parseInt(`1${rawText.slice(1)}`, 10) || rawId;
        }
        return String(rawId);
    }

    function parseReleaseTimestamp(raw) {
        const value = String(raw).trim();
        if (!value) return 0;

        // The card database commonly stores timestamps as `YYYY-MM-DD HH:mm:ss`
        // without a zone. Interpret those as UTC so release ordering stays
        // consistent across browsers and local time zones.
        const localZoneFree = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/);
        const parsed = Date.parse(localZoneFree ? `${localZoneFree[1]}T${localZoneFree[2]}Z` : value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function routeCardId(value) {
        let id = Number.parseInt(value, 10) || 0;
        if (id > 10000000) id = Math.floor(id / 10);
        return id ? String(id) : '';
    }

    function buildRouteReleaseDates(routes) {
        const dates = new Map();
        routes.forEach((route) => {
            if (!/Dokkan|Zet/i.test(String(route?.type || ''))) return;
            const targetId = routeCardId(route.awaked_card_id);
            const timestamp = parseReleaseTimestamp(route.open_at || route.start_at || '');
            if (!targetId || !timestamp) return;
            dates.set(targetId, Math.max(dates.get(targetId) || 0, timestamp));
        });
        return dates;
    }

    function releaseTimestamp(card) {
        const parentId = routeCardId(card?.parent_id || card?.id);
        const cardId = routeCardId(card?.id);
        const routeRelease = state.routeReleaseDates.get(parentId) || state.routeReleaseDates.get(cardId);
        if (routeRelease) return routeRelease;
        return parseReleaseTimestamp(card?.open_at || card?.start_at || card?.release_date || '');
    }

    function rarityRank(card) {
        const rarity = Number(card?.rarity);
        if (Number.isFinite(rarity)) return rarity;
        const normalized = String(card?.rarity || '').toLocaleLowerCase();
        return normalized === 'lr' ? 5 : (normalized === 'tur' ? 4 : (normalized === 'ssr' ? 3 : 0));
    }

    function compareNewestRelease(first, second) {
        const firstRelease = releaseTimestamp(first);
        const secondRelease = releaseTimestamp(second);
        const futureThreshold = Date.now() + (30 * 24 * 60 * 60 * 1000);
        const firstIsFuture = firstRelease > futureThreshold;
        const secondIsFuture = secondRelease > futureThreshold;
        if (firstIsFuture !== secondIsFuture) return firstIsFuture ? 1 : -1;

        const timeDifference = secondRelease - firstRelease;
        if (timeDifference) return timeDifference;
        const firstId = Number(first?.id) || 0;
        const secondId = Number(second?.id) || 0;
        return secondId - firstId;
    }

    function sortCompatibilityResults(results) {
        return results.map((result, index) => {
            const amount = result.amount === null || result.amount === undefined || result.amount === ''
                ? null
                : Number(result.amount);
            return { result, index, amount: Number.isFinite(amount) ? amount : null };
        }).sort((first, second) => {
            if (first.amount === null && second.amount !== null) return 1;
            if (second.amount === null && first.amount !== null) return -1;
            if (first.amount !== null && second.amount !== null && first.amount !== second.amount) {
                return second.amount - first.amount;
            }

            // Reuse the route/date normalization and deterministic ID tie-breaker.
            return compareNewestRelease(first.result.card, second.result.card)
                || first.index - second.index;
        }).map(({ result }) => result);
    }

    function compareAwakeningState(first, second) {
        const firstState = Number(Boolean(first?.is_seza)) * 2 + Number(Boolean(first?.is_eza));
        const secondState = Number(Boolean(second?.is_seza)) * 2 + Number(Boolean(second?.is_eza));
        return secondState - firstState;
    }

    function selectHighestRarityLineageCards(cards, routes) {
        const byId = new Map(cards.map((card) => [String(card.id), card]));
        const parentById = new Map(Array.from(byId.keys(), (id) => [id, id]));

        function find(id) {
            const current = parentById.get(id);
            if (current === undefined) return null;
            if (current === id) return id;
            const root = find(current);
            parentById.set(id, root);
            return root;
        }

        function union(firstReference, secondReference) {
            const candidatesFor = (reference) => {
                const exact = String(reference ?? '');
                const normalized = normalizedCardReferenceId(exact);
                return [exact, normalized].find((candidate) => parentById.has(candidate)) || null;
            };
            const firstId = candidatesFor(firstReference);
            const secondId = candidatesFor(secondReference);
            if (!firstId || !secondId) return;
            const firstRoot = find(firstId);
            const secondRoot = find(secondId);
            if (firstRoot && secondRoot && firstRoot !== secondRoot) parentById.set(secondRoot, firstRoot);
        }

        cards.forEach((card) => {
            const cardId = String(card.id);
            if (card.parent_id !== undefined && card.parent_id !== null && String(card.parent_id) !== cardId) {
                union(cardId, card.parent_id);
            }
            if (card.transform_parent_id !== undefined && card.transform_parent_id !== null) {
                union(cardId, card.transform_parent_id);
            }
        });

        routes.forEach((route) => {
            const type = String(route?.type || '');
            if (!/Dokkan|Zet/i.test(type)) return;
            union(route.card_id, route.awaked_card_id);
        });

        const lineages = new Map();
        cards.forEach((card) => {
            const root = find(String(card.id)) || String(card.id);
            const lineage = lineages.get(root) || [];
            lineage.push(card);
            lineages.set(root, lineage);
        });

        return Array.from(lineages.values(), (lineage) => lineage.sort((first, second) =>
            rarityRank(second) - rarityRank(first)
            || compareAwakeningState(first, second)
            || compareNewestRelease(first, second)
            || (Number(second.id) || 0) - (Number(first.id) || 0)
        )[0]).sort(compareNewestRelease);
    }

    function extractQuotedCategoryNames(text) {
        return new Set(Array.from(String(text || '').matchAll(/["“]([^"”]+)["”]/g), (match) => normalizeText(match[1]).toLocaleLowerCase()));
    }

    function extractStatBuffs(text) {
        const amounts = {};
        const expression = /((?:HP|ATK|DEF)(?:\s*(?:,|&|and)\s*(?:HP|ATK|DEF)){0,2})\s*\+\s*(\d+)\s*%/gi;
        for (const match of String(text || '').matchAll(expression)) {
            const amount = Number.parseInt(match[2], 10);
            const stats = new Set((match[1].match(/HP|ATK|DEF/gi) || []).map((stat) => stat.toUpperCase()));
            stats.forEach((stat) => { amounts[stat] = amount; });
        }
        return Object.keys(amounts).length ? { amounts } : null;
    }

    function formatStatBuff(buff) {
        const amounts = buff?.amounts || buff;
        if (!amounts || typeof amounts !== 'object') return '';

        const groups = new Map();
        ['HP', 'ATK', 'DEF'].forEach((stat) => {
            const amount = Number(amounts[stat]);
            if (!Number.isFinite(amount)) return;
            const stats = groups.get(amount) || [];
            stats.push(stat);
            groups.set(amount, stats);
        });

        return Array.from(groups, ([amount, stats]) => `+${amount}% ${stats.join('/')}`).join(' · ');
    }

    function extractConditions(text) {
        const quotedNames = extractQuotedCategoryNames(text);
        const categories = state.categories.filter((category) => quotedNames.has(normalizeText(category.name).toLocaleLowerCase()));
        const typeRules = [];
        const typeExpression = /\b(?:All\s+Types|(?:(?:Super|Extreme)\s+)?(?:AGL|TEQ|INT|STR|PHY)(?:\s*(?:,|&|and)\s*(?:(?:Super|Extreme)\s+)?(?:AGL|TEQ|INT|STR|PHY))*\s+Types?)\b/gi;
        for (const match of String(text || '').matchAll(typeExpression)) {
            const phrase = match[0];
            const classes = /\bsuper\b/i.test(phrase) ? ['super'] : (/\bextreme\b/i.test(phrase) ? ['extreme'] : []);
            const allTypes = /\ball\s+types\b/i.test(phrase);
            const types = allTypes
                ? TYPE_NAMES
                : Array.from(new Set((phrase.match(/AGL|TEQ|INT|STR|PHY/gi) || []).map((type) => type.toUpperCase())));
            typeRules.push({ phrase, classes, types });
        }

        const classRules = [];
        for (const match of String(text || '').matchAll(/\b(Super|Extreme)\s+Class(?:\s+allies)?\b/gi)) {
            classRules.push({ phrase: match[0], cardClass: match[1].toLowerCase() });
        }

        return {
            categories,
            typeRules,
            classRules,
            hasConditions: Boolean(categories.length || typeRules.length || classRules.length)
        };
    }

    function parseBaseRules(baseText) {
        const branches = String(baseText || '').split(/;\s*(?:or\s*)?/i).map((text) => text.trim()).filter(Boolean);
        const parsedBranches = branches.map((text) => ({ text, conditions: extractConditions(text), buff: extractStatBuffs(text) }));
        const distinctBuffBranches = parsedBranches.filter((branch) => branch.buff && branch.conditions.hasConditions);

        if (parsedBranches.length > 1 && distinctBuffBranches.length > 1) {
            return distinctBuffBranches;
        }

        const conditions = extractConditions(baseText);
        const buff = extractStatBuffs(baseText);
        return conditions.hasConditions ? [{ text: baseText, conditions, buff }] : [];
    }

    function parseLeaderSkill(skill) {
        const description = String(skill?.description || skill?.effect || skill?.details || '').trim();
        const normalized = normalizeText(description);
        const marker = /\bplus\s+(?:an\s+)?additional\b/i.exec(normalized);
        const baseText = marker ? normalized.slice(0, marker.index) : normalized;
        const additionalText = marker ? normalized.slice(marker.index) : '';
        const baseRules = parseBaseRules(baseText);
        const additionalConditions = extractConditions(additionalText);
        const additionalBuff = extractStatBuffs(additionalText);
        const additionalHasConditionLanguage = /\b(?:for|who|when|if|also|only|unless)\b/i.test(additionalText);
        const additionalUnconditional = Boolean(additionalText && !additionalConditions.hasConditions && !additionalHasConditionLanguage);
        const unresolvedAdditionalCondition = Boolean(additionalText && !additionalConditions.hasConditions && !additionalUnconditional);

        return {
            description,
            baseBuff: extractStatBuffs(baseText),
            baseRules,
            additionalText,
            additionalConditions,
            additionalBuff,
            additionalUnconditional,
            unresolvedAdditionalCondition,
            isSupported: baseRules.length > 0
        };
    }

    function conditionMatches(card, conditions) {
        const categorySet = new Set((Array.isArray(card.categories) ? card.categories : []).map((id) => Number(id)));
        const matchingCategories = conditions.categories.filter((category) => categorySet.has(Number(category.id)));
        const candidateType = typeInfo(card.element);
        const matchingTypes = conditions.typeRules.filter((rule) =>
            rule.types.includes(candidateType.type) && (!rule.classes.length || rule.classes.includes(candidateType.cardClass))
        );
        const matchingClasses = conditions.classRules.filter((rule) => rule.cardClass === candidateType.cardClass);
        return {
            matches: Boolean(matchingCategories.length || matchingTypes.length || matchingClasses.length),
            matchingCategories,
            matchingTypes,
            matchingClasses
        };
    }

    function categoryNamesFor(ids) {
        return ids.map((category) => category.name).filter(Boolean);
    }

    function evaluateCard(card, parsedSkill) {
        const matchingRules = parsedSkill.baseRules
            .map((rule) => ({ rule, match: conditionMatches(card, rule.conditions) }))
            .filter((entry) => entry.match.matches);
        if (!matchingRules.length) return null;

        const additionalMatch = parsedSkill.additionalConditions.hasConditions
            ? conditionMatches(card, parsedSkill.additionalConditions)
            : { matches: parsedSkill.additionalUnconditional };

        const options = matchingRules.map(({ rule, match }) => {
            const baseBuff = rule.buff || parsedSkill.baseBuff;
            const full = parsedSkill.additionalText
                ? additionalMatch.matches && !parsedSkill.unresolvedAdditionalCondition
                : true;
            const totalBuff = { ...(baseBuff?.amounts || {}) };
            if (full && parsedSkill.additionalBuff?.amounts) {
                Object.entries(parsedSkill.additionalBuff.amounts).forEach(([stat, amount]) => {
                    totalBuff[stat] = (totalBuff[stat] || 0) + amount;
                });
            }
            const values = Object.values(totalBuff);
            const amount = values.length ? values.reduce((sum, value) => sum + value, 0) : null;
            const display = formatStatBuff(totalBuff) || 'Leader skill covered';

            const baseCategoryNames = categoryNamesFor(match.matchingCategories);
            const extraCategoryNames = parsedSkill.additionalConditions.hasConditions
                ? categoryNamesFor(additionalMatch.matchingCategories || [])
                : [];
            const reasons = [
                ...baseCategoryNames,
                ...(match.matchingTypes || []).map((typeRule) => typeRule.phrase),
                ...(match.matchingClasses || []).map((classRule) => classRule.phrase)
            ];

            return {
                card,
                full,
                amount,
                totalBuff,
                display,
                reasons,
                extraCategoryNames,
                uncertain: parsedSkill.unresolvedAdditionalCondition
            };
        });

        options.sort((a, b) => (Number(b.full) - Number(a.full)) || ((b.amount ?? -1) - (a.amount ?? -1)));
        return options[0];
    }

    function setStatus(message, status = 'info') {
        elements.dataStatus.textContent = message;
        elements.dataStatus.dataset.state = status;
    }

    function leaderPickerStatModel(parsed) {
        const rules = Array.isArray(parsed?.baseRules) ? parsed.baseRules : [];
        const baseBuffs = (rules.length ? rules : [{}])
            .map((rule) => rule.buff || parsed?.baseBuff)
            .map((buff) => buff?.amounts || buff)
            .filter((amounts) => amounts && typeof amounts === 'object');
        const additionalAmounts = parsed?.additionalBuff?.amounts || {};
        const additionalKind = parsed?.additionalUnconditional
            ? 'always'
            : (parsed?.additionalConditions?.hasConditions ? 'conditional' : 'condition not parsed');

        return ['HP', 'ATK', 'DEF'].map((stat) => {
            const rawAdditional = additionalAmounts[stat];
            return {
                stat,
                baseValues: Array.from(new Set(baseBuffs
                    .map((amounts) => amounts[stat])
                    .filter((value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)))
                    .map(Number))).sort((first, second) => first - second),
                additional: rawAdditional === null || rawAdditional === undefined || rawAdditional === ''
                    ? null
                    : (Number.isFinite(Number(rawAdditional)) ? Number(rawAdditional) : null),
                additionalKind
            };
        });
    }

    let activeLeaderPickerTooltip = null;
    let leaderPickerTooltipListenersInstalled = false;
    let leaderPickerTooltipElement = null;

    function getLeaderPickerTooltip() {
        const pickerRoot = document.getElementById(PICKER_ID);
        if (!pickerRoot) return null;
        if (leaderPickerTooltipElement) return leaderPickerTooltipElement;

        const tooltip = document.createElement('div');
        tooltip.id = 'lc-leader-picker-tooltip';
        tooltip.className = 'lc-picker-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        const characterName = document.createElement('strong');
        characterName.className = 'lc-picker-tooltip-character';
        const skillName = document.createElement('span');
        skillName.className = 'lc-picker-tooltip-skill-name';
        const skillDescription = document.createElement('span');
        skillDescription.className = 'lc-picker-tooltip-description';
        tooltip.append(characterName, skillName, skillDescription);
        tooltip.characterHeading = characterName;
        tooltip.skillHeading = skillName;
        tooltip.skillDescription = skillDescription;
        tooltip.addEventListener('pointerleave', (event) => {
            if (event.relatedTarget && activeLeaderPickerTooltip?.card.contains(event.relatedTarget)) return;
            if (!activeLeaderPickerTooltip?.pinned) closeActiveLeaderPickerTooltip();
        });
        pickerRoot.appendChild(tooltip);
        leaderPickerTooltipElement = tooltip;
        return tooltip;
    }

    function closeActiveLeaderPickerTooltip() {
        if (!activeLeaderPickerTooltip) return;
        const active = activeLeaderPickerTooltip;
        activeLeaderPickerTooltip = null;
        active.card.classList.remove('is-tooltip-open', 'is-tooltip-pinned');
        active.infoButton.setAttribute('aria-expanded', 'false');
        active.infoButton.setAttribute('aria-label', active.closedLabel);
        active.tooltip.classList.remove('is-tooltip-visible');
        active.tooltip.setAttribute('aria-hidden', 'true');
    }

    function updateLeaderPickerTooltipPosition() {
        const active = activeLeaderPickerTooltip;
        if (!active || !active.card.classList.contains('is-tooltip-open')) return;
        const pickerRoot = document.getElementById(PICKER_ID);
        if (active.card.isConnected === false || pickerRoot?.hidden) {
            closeActiveLeaderPickerTooltip();
            return;
        }

        const anchorRect = active.anchor.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        if (anchorRect.bottom < 0 || anchorRect.top > viewportHeight) {
            closeActiveLeaderPickerTooltip();
            return;
        }

        active.tooltip.classList.add('is-tooltip-visible');
        active.tooltip.setAttribute('aria-hidden', 'false');
        const position = computeTooltipPosition(anchorRect, active.tooltip.getBoundingClientRect(), {
            width: viewportWidth,
            height: viewportHeight
        });
        active.tooltip.style.left = `${position.viewportLeft}px`;
        active.tooltip.style.top = `${position.viewportTop}px`;
        active.tooltip.style.right = 'auto';
        active.tooltip.style.bottom = 'auto';
    }

    function installLeaderPickerTooltipListeners() {
        if (leaderPickerTooltipListenersInstalled || typeof window === 'undefined') return;
        leaderPickerTooltipListenersInstalled = true;
        window.addEventListener('scroll', updateLeaderPickerTooltipPosition, true);
        window.addEventListener('resize', updateLeaderPickerTooltipPosition);
        window.addEventListener('pointerdown', (event) => {
            const active = activeLeaderPickerTooltip;
            if (!active || active.card.contains(event.target) || active.tooltip.contains(event.target)) return;
            closeActiveLeaderPickerTooltip();
        }, true);
    }

    function showLeaderPickerTooltip(card, anchor, infoButton, tooltip, content, pinned = false) {
        if (!tooltip) return;
        if (activeLeaderPickerTooltip?.card !== card) {
            closeActiveLeaderPickerTooltip();
            activeLeaderPickerTooltip = {
                card,
                anchor,
                infoButton,
                tooltip,
                closedLabel: infoButton.dataset.closedLabel,
                pinned: false
            };
        }
        const active = activeLeaderPickerTooltip;
        active.pinned = active.pinned || pinned;
        tooltip.characterHeading.textContent = content.characterName;
        tooltip.skillHeading.textContent = content.skillName;
        tooltip.skillDescription.textContent = content.skillDescription;
        card.classList.add('is-tooltip-open');
        card.classList.toggle('is-tooltip-pinned', active.pinned);
        infoButton.setAttribute('aria-expanded', 'true');
        infoButton.setAttribute('aria-label', active.pinned ? infoButton.dataset.openLabel : infoButton.dataset.closedLabel);
        installLeaderPickerTooltipListeners();
        updateLeaderPickerTooltipPosition();
    }

    function createLeaderPickerCard(entry) {
        const { card, leader, parsed } = entry;
        const type = typeInfo(card.element);
        const typeKey = type.type.toLocaleLowerCase();
        const characterName = card.name || `Card ${card.id}`;
        const skillNameText = leader.name || 'Leader Skill';
        const skillDescriptionText = parsed.description || 'Leader skill details are unavailable.';
        const cardRoot = document.createElement('div');
        cardRoot.className = `picker-unit-card picker-type-${typeKey} lc-leader-picker-card`;
        cardRoot.dataset.type = typeKey;

        const stats = leaderPickerStatModel(parsed);
        const spokenStats = stats.map(({ stat, baseValues, additional, additionalKind }) => {
            const base = baseValues.length ? `base ${baseValues.map((value) => `plus ${value} percent`).join(' or ')}` : 'no parsed base percentage';
            const extra = additional === null ? '' : `, plus ${additional} percent ${additionalKind}`;
            return `${stat}: ${base}${extra}`;
        }).join('. ');
        const accessibleName = `${characterName}, ${type.label}. ${skillNameText}. ${skillDescriptionText}. ${spokenStats}`;
        const tooltip = getLeaderPickerTooltip();

        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.className = 'lc-leader-picker-select';
        selectButton.setAttribute('aria-label', accessibleName);
        selectButton.setAttribute('aria-describedby', tooltip?.id || '');
        if (String(state.selectedCard?.id) === String(card.id)) selectButton.setAttribute('aria-current', 'true');

        const portrait = document.createElement('span');
        portrait.className = 'picker-thumb-wrapper';
        portrait.setAttribute('aria-hidden', 'true');
        const frame = document.createElement('img');
        frame.className = 'picker-frame';
        frame.src = `https://abscustom.github.io/assets/images/frame_${typeKey}.png`;
        frame.alt = '';
        frame.loading = 'lazy';
        const circle = safeImage(card, 'picker-thumb', '', true);
        circle.setAttribute('aria-hidden', 'true');
        portrait.append(frame, circle);

        const statGrid = document.createElement('span');
        statGrid.className = 'lc-picker-stats';
        statGrid.setAttribute('aria-label', 'Leader skill percentages');
        stats.forEach(({ stat, baseValues, additional, additionalKind }) => {
            const cell = document.createElement('span');
            cell.className = `lc-picker-stat lc-picker-stat-${stat.toLocaleLowerCase()}`;

            const label = document.createElement('span');
            label.className = 'lc-picker-stat-name';
            label.textContent = stat;
            const value = document.createElement('strong');
            value.className = 'lc-picker-stat-base';
            value.textContent = baseValues.length ? baseValues.map((amount) => `+${amount}%`).join(' / ') : '—';
            value.title = baseValues.length > 1
                ? 'Base percentage varies across parsed leader-skill clauses.'
                : 'Parsed base leader-skill percentage.';

            const baseTag = document.createElement('small');
            baseTag.className = 'lc-picker-stat-kind';
            baseTag.textContent = baseValues.length > 1 ? 'BASE VARIES' : 'BASE';
            cell.append(label, value, baseTag);

            if (additional !== null) {
                const extra = document.createElement('small');
                extra.className = `lc-picker-stat-extra is-${additionalKind.replaceAll(' ', '-')}`;
                extra.textContent = `+${additional}% ${additionalKind}`;
                if (parsed.additionalText) extra.title = parsed.additionalText;
                cell.appendChild(extra);
            }

            statGrid.appendChild(cell);
        });

        selectButton.append(portrait, statGrid);

        const infoButton = document.createElement('button');
        infoButton.type = 'button';
        infoButton.className = 'lc-leader-picker-info';
        infoButton.textContent = 'i';
        infoButton.dataset.closedLabel = `Show details for ${characterName}`;
        infoButton.dataset.openLabel = `Hide details for ${characterName}`;
        infoButton.setAttribute('aria-label', infoButton.dataset.closedLabel);
        infoButton.setAttribute('aria-expanded', 'false');
        infoButton.setAttribute('aria-controls', tooltip?.id || '');
        infoButton.setAttribute('aria-describedby', tooltip?.id || '');

        const tooltipContent = {
            characterName,
            skillName: skillNameText,
            skillDescription: skillDescriptionText
        };

        const hideUnlessFocusedOrPinned = () => {
            if (activeLeaderPickerTooltip?.card !== cardRoot || activeLeaderPickerTooltip.pinned) return;
            if (document.activeElement && cardRoot.contains(document.activeElement)) return;
            closeActiveLeaderPickerTooltip();
        };
        cardRoot.addEventListener('pointerenter', (event) => {
            if (event.pointerType !== 'touch') showLeaderPickerTooltip(cardRoot, infoButton, infoButton, tooltip, tooltipContent);
        });
        cardRoot.addEventListener('pointerleave', (event) => {
            if (event.relatedTarget && (cardRoot.contains(event.relatedTarget) || tooltip?.contains(event.relatedTarget))) return;
            hideUnlessFocusedOrPinned();
        });
        cardRoot.addEventListener('focusin', () => showLeaderPickerTooltip(cardRoot, infoButton, infoButton, tooltip, tooltipContent));
        cardRoot.addEventListener('focusout', (event) => {
            if (event.relatedTarget && cardRoot.contains(event.relatedTarget)) return;
            hideUnlessFocusedOrPinned();
        });
        cardRoot.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || activeLeaderPickerTooltip?.card !== cardRoot) return;
            event.preventDefault();
            event.stopPropagation();
            closeActiveLeaderPickerTooltip();
        });
        infoButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (activeLeaderPickerTooltip?.card === cardRoot && activeLeaderPickerTooltip.pinned) {
                closeActiveLeaderPickerTooltip();
            } else {
                showLeaderPickerTooltip(cardRoot, infoButton, infoButton, tooltip, tooltipContent, true);
            }
        });

        cardRoot.append(selectButton, infoButton);
        return cardRoot;
    }

    function openLeaderPicker({ automatic = false } = {}) {
        if (automatic) {
            if (state.autoPickerAttempted || state.selectedCard) return;
            state.autoPickerAttempted = true;
        }
        if (!window.DokkanUnitPicker?.open) {
            setStatus('The character selector is unavailable. Reload the page to try again.', 'error');
            return;
        }

        window.DokkanUnitPicker.open({
            id: PICKER_ID,
            gridId: PICKER_GRID_ID,
            dialogClass: 'lc-unit-picker-dialog',
            title: 'Select Leader',
            searchLabel: 'Search eligible leaders by character, type, or skill',
            searchPlaceholder: 'Search characters or leader skills…',
            resultsLabel: 'Characters with supported leader skills',
            emptyMessage: 'No supported leader skills match this search.',
            items: state.leaderCards,
            pageSize: 100,
            getSearchText: ({ card, leader, parsed }) => [
                card.name,
                card.id,
                typeInfo(card.element).label,
                leader.name,
                parsed.description
            ].join(' '),
            renderItem: createLeaderPickerCard,
            isSelected: ({ card }) => String(state.selectedCard?.id) === String(card.id),
            onClose: closeActiveLeaderPickerTooltip,
            onSelect: ({ card }) => selectLeader(card.id, { focusPortrait: true })
        });
    }

    function createLeaderPanel(card, leader, parsed) {
        const type = typeInfo(card.element);
        elements.leaderPortrait.replaceChildren(...createPortraitLayers(card));
        elements.leaderPortrait.style.setProperty('--lc-type-color', type.color);
        elements.leaderType.textContent = type.label;
        elements.leaderType.style.setProperty('--lc-type-color', type.color);
        elements.leaderName.textContent = card.name || `Card ${card.id}`;
        elements.leaderSkillName.textContent = leader.name || 'Leader Skill';
        elements.leaderDescription.textContent = parsed.description || 'This card has no leader skill description in the local database.';
        let categories = elements.selectedPanel.querySelector('.lc-leader-categories');
        if (!categories) {
            categories = document.createElement('div');
            categories.className = 'lc-leader-categories lc-match-reasons';
            elements.leaderDescription.after(categories);
        }
        categories.replaceChildren();
        appendCategoryChips(categories,
            [...new Set(parsed.baseRules.flatMap((rule) => rule.conditions.categories.map((category) => category.name)))],
            parsed.additionalConditions.categories.map((category) => category.name));

        if (!parsed.isSupported) {
            elements.leaderNote.textContent = 'The description is shown as stored, but its coverage conditions are not recognized, so compatible characters cannot be calculated for this skill yet.';
        } else if (parsed.unresolvedAdditionalCondition) {
            elements.leaderNote.textContent = 'The base coverage is calculated from the local category and type data. This skill has an additional condition that cannot be recognized yet, so its extra percentage is not applied automatically.';
        } else {
            const baseBuffDescriptions = Array.from(new Set(parsed.baseRules.map((rule) => formatStatBuff(rule.buff)).filter(Boolean)));
            const baseBuffDescription = baseBuffDescriptions.join(' or ') || formatStatBuff(parsed.baseBuff);
            const additionalBuffDescription = formatStatBuff(parsed.additionalBuff);
            if (baseBuffDescription && additionalBuffDescription) {
                elements.leaderNote.textContent = `Base matches receive ${baseBuffDescription}. Matching the additional condition adds ${additionalBuffDescription}.`;
            } else if (baseBuffDescription) {
                elements.leaderNote.textContent = `Compatible characters receive ${baseBuffDescription}.`;
            } else {
                elements.leaderNote.textContent = 'The category and type matches are shown. This leader skill does not include a recognized HP, ATK, or DEF percentage.';
            }
        }

        elements.selectedPanel.hidden = false;
    }

    function updateResultsSummary() {
        const fullCount = state.results.filter((result) => result.full).length;
        const baseCount = state.results.length - fullCount;
        elements.resultsSummary.textContent = `${state.results.length.toLocaleString()} eligible cards · ${fullCount.toLocaleString()} full · ${baseCount.toLocaleString()} base only`;
    }

    function resultMatchesSearch(result, term) {
        if (!term) return true;
        const categoryNames = [
            ...result.reasons,
            ...result.extraCategoryNames
        ].join(' ');
        return `${result.card.name || ''} ${categoryNames}`.toLocaleLowerCase().includes(term);
    }

    function createPortraitLayers(card) {
        const type = typeInfo(card.element);
        const rarity = Number(card.rarity) === 5 ? 'LR' : (Number(card.rarity) === 4 ? 'TUR' : 'SSR');
        const base = 'https://abscustom.github.io/assets/images/';
        const layer = (className, path) => {
            const image = document.createElement('img');
            image.className = className;
            image.src = base + path;
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            return image;
        };
        const circle = safeImage(card, 'lc-portrait-circle', '', true);
        return [
            layer('lc-dokkan-frame', `frame_${type.type.toLowerCase()}.png`),
            safeImage(card, 'lc-portrait-art', ''),
            circle,
            layer('lc-dokkan-rarity', rarity === 'SSR' ? 'rarity_ssr.png' : `rarity_${rarity}.png`),
            layer('lc-dokkan-type', `${rarity === 'SSR' ? '' : type.cardClass + '_'}type_${type.type.toLowerCase()}.png`)
        ];
    }

    function appendCategoryChips(container, primary, bonus) {
        for (const [names, kind] of [[primary, 'primary'], [bonus, 'bonus']]) {
            names.forEach((name) => {
                const chip = document.createElement('span');
                chip.className = `lc-category-${kind}`;
                chip.textContent = name;
                chip.title = `${kind === 'bonus' ? 'Additional bonus' : 'Primary coverage'}: ${name}`;
                container.appendChild(chip);
            });
        }
    }

    let activeTooltip = null;
    let tooltipViewportListenersInstalled = false;

    function computeTooltipPosition(anchorRect, tooltipRect, viewport) {
        const gutter = 8;
        const width = Math.min(tooltipRect.width || 0, Math.max(0, viewport.width - gutter * 2));
        const height = Math.min(tooltipRect.height || 0, Math.max(0, viewport.height - gutter * 2));
        const maxLeft = Math.max(gutter, viewport.width - width - gutter);
        const maxTop = Math.max(gutter, viewport.height - height - gutter);
        const viewportLeft = Math.max(gutter, Math.min(
            anchorRect.left + (anchorRect.width - width) / 2,
            maxLeft
        ));
        const aboveTop = anchorRect.top - height - gutter;
        const belowTop = anchorRect.bottom + gutter;
        const aboveFits = aboveTop >= gutter;
        const belowFits = belowTop + height <= viewport.height - gutter;
        const side = aboveFits ? 'above' : (belowFits ? 'below' : 'clamped');
        const preferredTop = side === 'above' ? aboveTop : belowTop;
        const viewportTop = Math.max(gutter, Math.min(preferredTop, maxTop));

        return {
            left: viewportLeft - anchorRect.left,
            top: viewportTop - anchorRect.top,
            viewportLeft,
            viewportTop,
            side
        };
    }

    function updateActiveTooltipPosition() {
        if (!activeTooltip || !activeTooltip.isOpen()) return;
        const { link, tooltip } = activeTooltip;
        const anchorRect = link.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        if (anchorRect.bottom < 0 || anchorRect.top > viewportHeight) {
            tooltip.classList.remove('is-tooltip-visible');
            link.classList.remove('is-tooltip-owner');
            return;
        }

        const position = computeTooltipPosition(anchorRect, tooltip.getBoundingClientRect(), {
            width: viewportWidth,
            height: viewportHeight
        });
        tooltip.style.left = `${position.left}px`;
        tooltip.style.top = `${position.top}px`;
        tooltip.style.right = 'auto';
        tooltip.style.bottom = 'auto';
        tooltip.classList.add('is-tooltip-visible');
        link.classList.add('is-tooltip-owner');
    }

    function installTooltipViewportListeners() {
        if (tooltipViewportListenersInstalled || typeof window === 'undefined') return;
        tooltipViewportListenersInstalled = true;
        window.addEventListener('scroll', updateActiveTooltipPosition, true);
        window.addEventListener('resize', updateActiveTooltipPosition);
    }

    function setCardPresentation(presentation, persist = true) {
        const mode = presentation === 'dokkan' ? 'dokkan' : 'abs';
        elements.page.dataset.cardPresentation = mode;
        elements.presentationButtons.forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.cardPresentationOption === mode));
        });
        if (persist) {
            try {
                window.localStorage.setItem(PRESENTATION_STORAGE_KEY, mode);
            } catch {
                // The current-page selection still works without persistent storage.
            }
        }
    }

    function createUnitCard(result) {
        const { card } = result;
        const type = typeInfo(card.element);
        const link = document.createElement('a');
        link.className = 'lc-unit-card lc-unit-card--compact';
        link.href = new URL(`card.html?id=${encodeURIComponent(card.id)}`, document.baseURI).href;
        link.setAttribute('aria-label', `${card.name || 'Character'}, ${result.amount === null ? '' : `${result.amount}% combined HP, ATK and DEF, `}${result.display}, ${result.full ? 'full leader skill' : 'base leader skill only'}`);
        link.style.setProperty('--lc-type-color', type.color);

        const portrait = document.createElement('span');
        portrait.className = 'lc-unit-portrait';
        portrait.style.setProperty('--lc-type-color', type.color);
        portrait.append(...createPortraitLayers(card));
        link.appendChild(portrait);

        const tooltip = document.createElement('span');
        tooltip.className = 'lc-unit-tooltip';
        tooltip.id = `lc-unit-tooltip-${card.id}`;
        tooltip.setAttribute('role', 'tooltip');
        link.setAttribute('aria-describedby', tooltip.id);
        const name = document.createElement('span');
        name.className = 'lc-unit-name';
        name.textContent = card.name || `Card ${card.id}`;

        const subline = document.createElement('span');
        subline.className = 'lc-unit-subline';
        const arrow = document.createElement('img');
        arrow.className = `lc-unit-up-arrow ${result.full ? 'is-full' : 'is-partial'}`;
        arrow.src = 'https://abscustom.github.io/assets/images/passive_skill_dialog_arrow01.png';
        arrow.alt = '';
        arrow.setAttribute('aria-hidden', 'true');
        const percent = document.createElement('strong');
        percent.className = 'lc-result-total';
        percent.textContent = result.amount === null ? 'Covered' : `${result.amount}%`;
        subline.append(percent, arrow);
        const breakdown = document.createElement('span');
        breakdown.className = 'lc-result-breakdown';
        breakdown.textContent = ['HP', 'ATK', 'DEF'].filter((stat) => result.totalBuff[stat] !== undefined)
            .map((stat) => `${stat} ${result.totalBuff[stat]}%`).join(' · ') || result.display;

        const matchState = document.createElement('span');
        matchState.className = `lc-match-state${result.full ? '' : ' is-base'}`;
        matchState.textContent = result.uncertain ? 'Base · condition unknown' : (result.full ? 'Full leader skill' : 'Base only');
        tooltip.append(name, breakdown, matchState);

        const reasons = document.createElement('span');
        reasons.className = 'lc-match-reasons';
        appendCategoryChips(reasons, result.reasons.length ? result.reasons : [type.label], result.extraCategoryNames);
        tooltip.appendChild(reasons);
        link.append(subline, tooltip);
        let pointerInside = false;
        let focused = false;
        let dismissed = false;
        const isOpen = () => (pointerInside || focused) && !dismissed;
        const hideTooltip = () => {
            tooltip.classList.remove('is-tooltip-visible');
            link.classList.remove('is-tooltip-owner');
            if (activeTooltip?.link === link) activeTooltip = null;
        };
        const showTooltip = () => {
            if (dismissed) return;
            installTooltipViewportListeners();
            activeTooltip = { link, tooltip, isOpen };
            updateActiveTooltipPosition();
        };
        link.addEventListener('pointerenter', (event) => {
            if (event.pointerType === 'touch') return;
            pointerInside = true;
            dismissed = false;
            showTooltip();
        });
        link.addEventListener('focus', () => {
            focused = true;
            showTooltip();
        });
        link.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && isOpen()) {
                event.preventDefault();
                dismissed = true;
                hideTooltip();
            }
        });
        link.addEventListener('pointerleave', () => {
            pointerInside = false;
            if (!focused) {
                dismissed = false;
                hideTooltip();
            }
        });
        link.addEventListener('blur', () => {
            focused = false;
            if (!pointerInside) {
                dismissed = false;
                hideTooltip();
            }
        });
        return link;
    }

    function renderUnits(reset = true) {
        if (reset) state.visibleCount = PAGE_SIZE;
        const term = normalizeText(state.unitSearch).toLocaleLowerCase();
        const filtered = state.results.filter((result) => {
            if (state.matchFilter === 'full' && !result.full) return false;
            if (state.matchFilter === 'half' && result.full) return false;
            return resultMatchesSearch(result, term);
        });

        elements.unitsGrid.replaceChildren();
        filtered.slice(0, state.visibleCount).forEach((result) => elements.unitsGrid.appendChild(createUnitCard(result)));
        elements.loadMoreWrap.hidden = filtered.length <= state.visibleCount;

        if (!filtered.length) {
            const empty = document.createElement('div');
            empty.className = 'lc-results-empty';
            empty.textContent = state.results.length
                ? 'No compatible characters match this filter.'
                : 'No character cards match the selected leader skill conditions.';
            elements.unitsGrid.appendChild(empty);
            elements.loadMoreWrap.hidden = true;
        }
    }

    function selectLeader(cardId, { updateUrl = true, focusPortrait = false } = {}) {
        const id = String(cardId);
        const entry = state.leaderCards.find(({ card }) => String(card.id) === id);
        if (!entry) return false;

        state.selectedCard = entry.card;
        state.parsedSkill = entry.parsed || parseLeaderSkill(entry.leader);
        state.results = state.parsedSkill.isSupported
            ? state.cards.map((card) => evaluateCard(card, state.parsedSkill)).filter(Boolean)
            : [];
        state.results = sortCompatibilityResults(state.results);
        state.matchFilter = 'all';
        state.unitSearch = '';
        elements.unitSearch.value = '';
        document.querySelectorAll('[data-match-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.matchFilter === 'all')));

        createLeaderPanel(entry.card, entry.leader, state.parsedSkill);
        elements.pickerOpenFallback.hidden = true;
        elements.resultsToolbar.hidden = false;
        elements.resultsSection.hidden = false;
        elements.emptyState.hidden = true;
        updateResultsSummary();
        renderUnits(true);

        if (updateUrl) {
            const url = new URL(window.location.href);
            url.searchParams.set('leader', id);
            window.history.replaceState({}, '', url);
        }

        try {
            window.localStorage.setItem(SELECTED_LEADER_STORAGE_KEY, id);
        } catch {
            // URL selection remains available when browser storage is blocked.
        }
        if (focusPortrait) elements.leaderPortrait.focus();
        return true;
    }

    function getStoredLeaderId() {
        try {
            return String(window.localStorage.getItem(SELECTED_LEADER_STORAGE_KEY) || '');
        } catch {
            return '';
        }
    }

    function resolveInitialLeader(requestedLeaderId, storedLeaderId) {
        const findLeader = (id) => state.leaderCards.find(({ card }) => String(card.id) === String(id || '')) || null;
        const requested = findLeader(requestedLeaderId);
        if (requested) return { entry: requested, source: 'url' };

        const restored = findLeader(storedLeaderId);
        return restored ? { entry: restored, source: 'storage' } : null;
    }

    async function loadData() {
        try {
            const entries = await Promise.all(Object.entries(DATA_URLS).map(async ([key, path]) => {
                const response = await fetch(new URL(path, document.baseURI), { cache: 'no-store' });
                if (!response.ok) throw new Error(`${path} returned ${response.status}`);
                return [key, await response.json()];
            }));
            const data = Object.fromEntries(entries);
            if (!Array.isArray(data.cards) || !Array.isArray(data.leaders) || !Array.isArray(data.categories) || !Array.isArray(data.routes)) {
                throw new Error('One or more leader compatibility or awakening-lineage data files have an unsupported format.');
            }

            state.routeReleaseDates = buildRouteReleaseDates(data.routes);
            const allCards = data.cards.filter((card) => card && Number.isFinite(Number(card.id)) && card.name);
            state.cards = selectHighestRarityLineageCards(allCards, data.routes);
            state.leadersById = new Map(data.leaders.filter((leader) => leader && leader.id !== undefined).map((leader) => [String(leader.id), leader]));
            state.categories = data.categories.filter((category) => category && category.id !== undefined && category.name);
            state.allLeaderCards = allCards
                .map((card) => ({ card, leader: state.leadersById.get(String(card.lead_id)) }))
                .filter((entry) => Boolean(entry.leader?.description || entry.leader?.effect || entry.leader?.details))
                .map((entry) => ({ ...entry, parsed: parseLeaderSkill(entry.leader) }))
                .filter((entry) => entry.parsed.isSupported)
                .sort((first, second) => compareNewestRelease(first.card, second.card));
            const visibleCardIds = new Set(state.cards.map((card) => String(card.id)));
            state.leaderCards = state.allLeaderCards
                .filter(({ card }) => visibleCardIds.has(String(card.id)))
                .sort((first, second) => compareNewestRelease(first.card, second.card));

            if (!state.leaderCards.length) throw new Error('No cards with leader skill data were found.');
            setStatus(`${state.leaderCards.length.toLocaleString()} latest, highest-rarity leader cards ready. Search by character or leader skill.`);

            const requestedLeaderId = new URLSearchParams(window.location.search).get('leader');
            const initialLeader = resolveInitialLeader(requestedLeaderId, getStoredLeaderId());
            if (initialLeader) {
                selectLeader(initialLeader.entry.card.id, { updateUrl: initialLeader.source === 'storage' });
            } else {
                openLeaderPicker({ automatic: true });
            }
        } catch (error) {
            console.error('[Leader Compatibility] Could not load its local data:', error);
            setStatus('Leader data could not be loaded. Check the local JSON files and reload this page.', 'error');
        }
    }

    function bindControls() {
        elements.pickerOpen.addEventListener('click', () => openLeaderPicker());
        elements.pickerOpenFallback.addEventListener('click', () => openLeaderPicker());
        elements.leaderPortrait.addEventListener('click', () => openLeaderPicker());
        elements.presentationButtons.forEach((button) => {
            button.addEventListener('click', () => setCardPresentation(button.dataset.cardPresentationOption));
        });
        setCardPresentation(elements.page.dataset.cardPresentation, false);
        elements.unitSearch.addEventListener('input', () => {
            state.unitSearch = elements.unitSearch.value;
            renderUnits(true);
        });
        document.querySelectorAll('[data-match-filter]').forEach((button) => {
            button.addEventListener('click', () => {
                state.matchFilter = button.dataset.matchFilter;
                document.querySelectorAll('[data-match-filter]').forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
                renderUnits(true);
            });
        });
        elements.loadMore.addEventListener('click', () => {
            state.visibleCount += PAGE_SIZE;
            renderUnits(false);
        });
    }

    bindControls();
    loadData();
})();
