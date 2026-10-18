const STYLE_ID = 'calc-draft-mode-styles';
const PANEL_ID = 'calc-draft-panel';
const EDITOR_ID = 'calc-draft-editor';
const BANNER_ID = 'calc-draft-banner';
const DRAWER_ID = 'calc-draft-drawer';
const WORKSPACE_ID = 'calc-draft-workspace';
const ERROR_ID = 'calc-draft-error';
const SKIP_CONTROL_IDS = new Set(['calc-link-atk', 'calc-link-def']);
const STAT_CONTROL_IDS = new Set([
    'calc-base-atk', 'calc-base-def', 'calc-lead',
    'calc-sot-atk', 'calc-sot-def', 'calc-p2-atk', 'calc-p2-def',
    'calc-domain-atk', 'calc-domain-def', 'calc-domain-active',
    'calc-active-temp-atk', 'calc-active-atk', 'calc-active-def', 'calc-active-skill-active', 'calc-active-sa-type',
    'calc-ki-slider', 'calc-ki-mult-base', 'calc-ki-mult-add', 'calc-sa-hipo-boost', 'calc-prev-sa-stacks',
    'calc-orbs-master-toggle', 'calc-orb-atk', 'calc-orb-def', 'calc-dr', 'calc-guard',
    'calc-hit-stacks-slider', 'calc-passive-hp-slider'
]);

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function plainText(value) {
    return String(value ?? '')
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
}

function effectValue(adjective, explicit) {
    if (explicit) return numeric(explicit);
    const word = String(adjective || '').toLowerCase();
    if (word === 'massively') return 100;
    if (word === 'greatly') return 50;
    return 30;
}

export function inferFurtherOneTurnRaises(text) {
    const result = { atk: 0, def: 0 };
    const plain = plainText(text);
    const pattern = /\bfurther\s+(?:(massively|greatly)\s+)?raises?\s+(ATK(?:\s*(?:&|and)\s*DEF)?|DEF(?:\s*(?:&|and)\s*ATK)?)(?:\s+by\s+(\d+(?:\.\d+)?)\s*%?)?(?:\s+for\s+\d+\s+turns?)?/gi;
    for (const match of plain.matchAll(pattern)) {
        const amount = effectValue(match[1], match[3]);
        const stat = match[2].toLowerCase();
        if (stat.includes('atk')) result.atk += amount;
        if (stat.includes('def')) result.def += amount;
    }
    return result;
}

export function inferAllySupport(text) {
    const result = { atk: 0, def: 0, duration: '' };
    const plain = plainText(text);
    const pattern = /\braises?\s+allies(?:['’]s?)?\s+(ATK(?:\s*(?:&|and)\s*DEF)?|DEF(?:\s*(?:&|and)\s*ATK)?)\s+by\s+(\d+(?:\.\d+)?)\s*%?(?:\s+for\s+(\d+\s+turns?))?/gi;
    for (const match of plain.matchAll(pattern)) {
        const stat = match[1].toLowerCase();
        const amount = numeric(match[2]);
        if (stat.includes('atk')) result.atk += amount;
        if (stat.includes('def')) result.def += amount;
        if (match[3]) result.duration = match[3];
    }
    return result;
}

export function makeCalculatorDraftKey(meta, formMode = 'base') {
    if (!meta) return '';
    const source = meta.cardItemMeta?.source || 'official';
    const rootId = meta.cardId ?? meta.rawCard?.id ?? 'unknown';
    const formId = meta.rawCard?.id ?? rootId;
    return [source, rootId, formId, formMode || 'base'].map(value => String(value)).join(':');
}

function hasAllyCondition(text) {
    return /\ball(?:y|ies)\b|same\s+turn|attacking\s+in\s+the\s+same\s+turn/i.test(plainText(text));
}

export function inferBaseSaTiming(text) {
    const selfBuffText = plainText(text)
        .replace(/\bfurther\s+(?:(?:massively|greatly)\s+)?raises?\s+[^,;]+?(?:\s+for\s+\d+\s+turns?)?(?=,|;|\band\b|$)/gi, '')
        .replace(/\braises?\s+allies(?:['’]s?)?\s+[^,;]+/gi, '');
    return /\bfor\s+\d+\s+turns?\b/i.test(selfBuffText) ? 'current-turn' : 'source';
}

function getProfile(meta) {
    const raw = meta?.rawCard || {};
    const mode = window.currentCalcEzaMode || 'base';
    return {
        name: String(raw.name || document.getElementById('sc-name')?.textContent || 'Current character'),
        type: String(window.currentCalcType || 'AGL').toUpperCase(),
        class: String(window.currentCalcClass || 'Super'),
        rarity: String(window.currentCalcRarity || 'TUR').toUpperCase(),
        awakening: window.currentCalcEza ? (mode === 'seza' ? 'seza' : 'eza') : mode,
        categories: Array.isArray(raw.categories) ? raw.categories.join(', ') : String(raw.categories || '')
    };
}

function captureControls() {
    const controls = {};
    document.querySelectorAll('input[id^="calc-"], select[id^="calc-"]').forEach(input => {
        if (input.id.startsWith('calc-draft-')) return;
        controls[input.id] = {
            kind: input.type === 'checkbox' ? 'checkbox' : input.tagName.toLowerCase(),
            value: input.value,
            checked: input.type === 'checkbox' ? !!input.checked : undefined
        };
    });
    return controls;
}

function controlValue(controls, id) {
    const control = controls?.[id];
    if (!control) return 0;
    return control.kind === 'checkbox' ? !!control.checked : control.value;
}

function setControlValue(controls, id, value) {
    if (!controls[id]) controls[id] = { kind: 'input', value: '', checked: undefined };
    if (controls[id].kind === 'checkbox') controls[id].checked = !!value;
    else controls[id].value = String(value ?? '');
}

function readControlValue(id) {
    const input = document.getElementById(id);
    if (!input) return undefined;
    return input.type === 'checkbox' ? !!input.checked : input.value;
}

function writeControlValue(id, value) {
    const input = document.getElementById(id);
    if (!input || value === undefined) return;
    if (input.type === 'checkbox') input.checked = !!value;
    else input.value = String(value ?? '');
}

function sumActiveLinks(links, stat) {
    return (links || []).reduce((sum, link) => sum + (link.active ? numeric(link[stat]) : 0), 0);
}

function captureSource(meta) {
    const controls = captureControls();
    const raw = meta?.rawCard || {};
    const priorities = raw.super_attacks || raw.superAttacks || [];
    const sas = clone(window.lastParsedSaBlocksData || []).map((sa, index) => ({
        ...sa,
        priority: sa.priority ?? priorities[index]?.priority ?? 0
    }));
    const links = window.calcDraftUiBridge?.getLinks?.() || [];
    return {
        profile: getProfile(meta),
        controls,
        passiveLines: clone(window.interactivePassiveLines || []),
        saBlocks: sas,
        links: clone(links),
        manualLinkAtk: numeric(controlValue(controls, 'calc-link-atk')) - sumActiveLinks(links, 'atk'),
        manualLinkDef: numeric(controlValue(controls, 'calc-link-def')) - sumActiveLinks(links, 'def'),
        currentHpPercent: numeric(window.currentHpPercent || 100),
        activeUnitSaBlockIdx: window.activeUnitSaBlockIdx ?? null,
        exToggleState: clone(window.exToggleState || {})
    };
}

function normalizePassiveLine(line, index = 0) {
    const text = plainText(line.draftText ?? line.text ?? 'Draft passive effect');
    const target = line.draftTarget || (line.isEnemyTargeted ? 'enemy' : line.isAllySupportOnly ? 'allies-excluded' : 'self');
    const inferred = inferAllySupport(text);
    return {
        ...clone(line),
        idx: line.idx ?? index,
        draftText: text,
        draftCondition: plainText(line.draftCondition || (line.isConditional ? text : '')),
        draftTarget: target,
        draftAtk: numeric(line.draftAtk ?? (line.isAllySupportOnly ? inferred.atk : line.atkStep)),
        draftDef: numeric(line.draftDef ?? (line.isAllySupportOnly ? inferred.def : line.defStep)),
        draftDr: numeric(line.draftDr ?? line.drVal ?? line.drStep),
        draftGuard: line.draftGuard ?? !!line.hasGuard,
        draftAdditionalKind: line.draftAdditionalKind || (line.isAdditionalUltraSa ? 'ultra' : line.isAdditionalSa ? 'sa' : 'none'),
        draftAdditionalSaMax: numeric(line.draftAdditionalSaMax ?? line.addSaMax ?? line.addSaCount),
        draftAdditionalSaCount: numeric(line.draftAdditionalSaCount ?? line.addSaCount ?? line.addSaMax),
        draftCounterKind: line.draftCounterKind || (line.isSaCounter ? 'sa' : line.isNormalCounter ? 'normal' : 'none'),
        draftCounterPower: numeric(line.draftCounterPower ?? line.counterPower ?? 300),
        draftCounterTempAtk: numeric(line.draftCounterTempAtk ?? line.counterTempAtk),
        draftCounterTrigger: line.draftCounterTrigger || line.counterTriggerCat || 'Super Attack',
        draftCounterTiming: line.draftCounterTiming || line.counterTiming || 'after',
        draftCounterCount: numeric(line.draftCounterCount ?? line.counterCount),
        draftTiming: line.draftTiming || (line.isOnSaWithinTurn ? 'within' : line.phase === 'p2' ? 'attack' : 'start'),
        draftStackCount: numeric(line.draftStackCount ?? line.stackCount ?? 1),
        draftMaxPctCap: numeric(line.draftMaxPctCap ?? line.maxPctCap ?? 0),
        draftActive: line.draftActive ?? line.active !== false,
        draftStacking: line.draftStacking ?? !!line.isStacking
    };
}

function normalizeSaBlock(sa, index, rawSa = {}) {
    const description = plainText(sa.draftFullText ?? sa.fullText ?? rawSa.description ?? '');
    const condition = plainText(sa.draftConditionText ?? sa.activationText ?? sa.condition ?? rawSa.condition ?? '');
    const inferredTurn = inferFurtherOneTurnRaises(description);
    const ally = inferAllySupport(description);
    const required = sa.draftConditionRequired ?? hasAllyCondition(condition);
    return {
        ...clone(sa),
        priority: sa.priority ?? rawSa.priority ?? 0,
        draftNameText: plainText(sa.draftNameText ?? sa.saName ?? rawSa.name ?? `Super Attack ${index + 1}`),
        draftFullText: description,
        draftConditionText: condition,
        draftConditionRequired: required,
        draftConditionMet: sa.draftConditionMet ?? !required,
        draftTarget: sa.draftTarget || 'self',
        draftAtk: numeric(sa.draftAtk ?? sa.eff?.atk),
        draftDef: numeric(sa.draftDef ?? sa.eff?.def),
        draftAtkTiming: sa.draftAtkTiming || inferBaseSaTiming(description),
        draftTurnAtk: numeric(sa.draftBaseTurnAtk ?? sa.draftTurnAtk ?? inferredTurn.atk),
        draftTurnDef: numeric(sa.draftBaseTurnDef ?? sa.draftTurnDef ?? inferredTurn.def),
        draftAllyAtk: numeric(sa.draftAllyAtk ?? ally.atk),
        draftAllyDef: numeric(sa.draftAllyDef ?? ally.def),
        draftIsEx: sa.draftIsEx ?? !!sa.is_ex,
        draftIsUnit: sa.draftIsUnit ?? !!(sa.is_unit_sa || sa.is_unit_ultra),
        draftStartKi: numeric(sa.draftStartKi ?? sa.startKi ?? sa.eball_num_start ?? (index ? 18 : 12)),
        draftEndKi: numeric(sa.draftEndKi ?? sa.endKi ?? sa.eball_num_end ?? 0),
        draftMultiplier: numeric(sa.draftMultiplier ?? sa.exact_multiplier ?? 505),
        draftTypeLabel: plainText(sa.draftTypeLabel ?? sa.typeLabel ?? 'Super Attack')
    };
}

function createDraftFromSource(source, meta) {
    const rawSas = meta?.rawCard?.super_attacks || meta?.rawCard?.superAttacks || [];
    const saBlocks = source.saBlocks.map((sa, index) => normalizeSaBlock(sa, index, rawSas[index] || {}));
    return {
        profile: clone(source.profile),
        controls: clone(source.controls),
        passiveLines: source.passiveLines.map((line, index) => normalizePassiveLine(line, index)),
        saBlocks,
        links: clone(source.links),
        manualLinkAtk: source.manualLinkAtk,
        manualLinkDef: source.manualLinkDef,
        stageOverrides: [],
        standbyNotes: '',
        currentHpPercent: source.currentHpPercent,
        activeUnitSaBlockIdx: source.activeUnitSaBlockIdx,
        exToggleState: clone(source.exToggleState),
        dirty: false
    };
}

function createEntry(meta) {
    const source = captureSource(meta);
    return { source, draft: createDraftFromSource(source, meta), applied: null };
}

function stageTotal(draft, stage, stat, saIndex = -1) {
    return (draft.stageOverrides || []).reduce((sum, row) => {
        if (!row.active || row.target !== 'self' || row.stage !== stage || !['both', stat.toLowerCase()].includes(row.stat)) return sum;
        if ((stage === 'sa-current' || stage === 'sa-turn') && Number(row.saIndex) !== Number(saIndex)) return sum;
        return sum + numeric(row.value);
    }, 0);
}

function syncRuntime(entry, draft = entry.applied) {
    if (!draft) return;
    const stageControlAdjustments = {
        'calc-domain-atk': stageTotal(draft, 'domain', 'atk'),
        'calc-domain-def': stageTotal(draft, 'domain', 'def'),
        'calc-active-atk': stageTotal(draft, 'active', 'atk'),
        'calc-active-def': stageTotal(draft, 'active', 'def')
    };
    Object.keys(draft.controls).forEach(id => {
        if (SKIP_CONTROL_IDS.has(id) || id.startsWith('calc-sa-')) return;
        const value = readControlValue(id);
        if (value === undefined) return;
        const control = draft.controls[id];
        if (control.kind === 'checkbox') control.checked = value;
        else {
            let next = value;
            if (stageControlAdjustments[id]) next = numeric(value) - stageControlAdjustments[id];
            control.value = String(next);
        }
    });

    draft.profile.type = String(window.currentCalcType || draft.profile.type).toUpperCase();
    draft.profile.class = String(window.currentCalcClass || draft.profile.class);
    draft.profile.rarity = String(window.currentCalcRarity || draft.profile.rarity).toUpperCase();
    if (window.currentCalcEza === false) draft.profile.awakening = 'base';
    else if (window.currentCalcEza === true && draft.profile.awakening === 'base') draft.profile.awakening = 'eza';

    const runtimePassive = (window.interactivePassiveLines || []).filter(line => !line.draftStageOverrideId);
    draft.passiveLines = runtimePassive.map((line, index) => normalizePassiveLine(line, index));

    const runtimeSas = window.lastParsedSaBlocksData || [];
    draft.saBlocks = runtimeSas.map((sa, index) => {
        const block = normalizeSaBlock(sa, index, {});
        const isSelfEffect = block.draftTarget === 'self' || block.draftTarget === 'allies-including-self';
        const atkControl = readControlValue(`calc-sa-atk-effect-${index}`);
        const defControl = readControlValue(`calc-sa-def-effect-${index}`);
        const runtimeTurnAtk = Object.prototype.hasOwnProperty.call(sa, 'draftBaseTurnAtk')
            ? numeric(sa.draftBaseTurnAtk) + stageTotal(draft, 'sa-turn', 'atk', index)
            : 0;
        block.draftAtk = isSelfEffect && atkControl !== undefined
            ? numeric(atkControl) - stageTotal(draft, 'sa-current', 'atk', index) - runtimeTurnAtk
            : numeric(sa.draftAtk ?? sa.eff?.atk);
        block.draftDef = isSelfEffect && defControl !== undefined
            ? numeric(defControl) - stageTotal(draft, 'sa-current', 'def', index)
            : numeric(sa.draftDef ?? sa.eff?.def);
        block.draftTurnAtk = numeric(sa.draftBaseTurnAtk ?? sa.draftTurnAtk);
        block.draftTurnDef = numeric(sa.draftBaseTurnDef ?? sa.draftTurnDef);
        block.draftMultiplier = numeric(document.getElementById(`calc-sa-type-${index}`)?.value || sa.exact_multiplier || block.draftMultiplier);
        block.draftNameText = plainText(sa.draftNameText ?? sa.saName);
        block.draftFullText = plainText(sa.draftFullText ?? sa.fullText);
        block.draftConditionText = plainText(sa.draftConditionText ?? sa.activationText ?? sa.condition);
        block.draftStartKi = numeric(sa.draftStartKi ?? sa.startKi ?? sa.eball_num_start);
        block.draftEndKi = numeric(sa.draftEndKi ?? sa.endKi ?? sa.eball_num_end);
        return block;
    });

    const links = window.calcDraftUiBridge?.getLinks?.() || draft.links;
    draft.links = clone(links).map(link => ({ ...link, name: plainText(link.name) }));
    const linkAtkWithStages = numeric(readControlValue('calc-link-atk')) - stageTotal(draft, 'links', 'atk');
    const linkDefWithStages = numeric(readControlValue('calc-link-def')) - stageTotal(draft, 'links', 'def');
    draft.manualLinkAtk = linkAtkWithStages - sumActiveLinks(draft.links, 'atk');
    draft.manualLinkDef = linkDefWithStages - sumActiveLinks(draft.links, 'def');

    draft.currentHpPercent = numeric(window.currentHpPercent ?? readControlValue('calc-passive-hp-slider') ?? draft.currentHpPercent ?? 100);
    draft.activeUnitSaBlockIdx = window.activeUnitSaBlockIdx ?? null;
    draft.exToggleState = clone(window.exToggleState || {});
}

function materializePassiveLine(line, index) {
    const target = line.draftTarget || 'self';
    const selfTarget = target === 'self' || target === 'allies-including-self';
    const additionalKind = line.draftAdditionalKind || 'none';
    const counterKind = line.draftCounterKind || 'none';
    const text = plainText(line.draftText ?? line.text);
    const timing = line.draftTiming || 'start';
    return {
        ...clone(line),
        idx: index,
        text: escapeHtml(text),
        draftText: text,
        draftCondition: plainText(line.draftCondition),
        draftTarget: target,
        draftAtk: numeric(line.draftAtk),
        draftDef: numeric(line.draftDef),
        atkStep: selfTarget ? numeric(line.draftAtk) : 0,
        defStep: selfTarget ? numeric(line.draftDef) : 0,
        phase: timing === 'attack' ? 'p2' : 'sot',
        isOnSaWithinTurn: timing === 'within',
        isAllySupportOnly: target === 'allies-excluded',
        isEnemyTargeted: target === 'enemy',
        isConditional: !!plainText(line.draftCondition),
        active: line.draftActive !== false,
        isStacking: !!line.draftStacking,
        stackCount: Math.max(1, numeric(line.draftStackCount) || 1),
        maxPctCap: numeric(line.draftMaxPctCap),
        drVal: selfTarget ? numeric(line.draftDr) : 0,
        drStep: selfTarget ? numeric(line.draftDr) : 0,
        hasGuard: selfTarget && !!line.draftGuard,
        isAdditionalSa: selfTarget && additionalKind === 'sa',
        isAdditionalUltraSa: selfTarget && additionalKind === 'ultra',
        addSaMax: numeric(line.draftAdditionalSaMax),
        addSaCount: numeric(line.draftAdditionalSaCount),
        isSaCounter: selfTarget && counterKind === 'sa',
        isNormalCounter: selfTarget && counterKind === 'normal',
        counterPower: numeric(line.draftCounterPower) || 300,
        counterTempAtk: numeric(line.draftCounterTempAtk),
        counterTriggerCat: plainText(line.draftCounterTrigger || 'Super Attack'),
        counterTiming: line.draftCounterTiming || 'after',
        counterCount: numeric(line.draftCounterCount),
        hasStatImpact: selfTarget && (numeric(line.draftAtk) !== 0 || numeric(line.draftDef) !== 0 || numeric(line.draftDr) !== 0 || !!line.draftGuard || additionalKind !== 'none' || counterKind !== 'none')
    };
}

function materializeStageLine(row, index) {
    const timing = row.stage === 'start' ? 'sot' : row.stage === 'attack' ? 'p2' : 'within';
    const targetApplies = row.target === 'self' || row.target === 'allies-including-self';
    return {
        idx: index,
        draftStageOverrideId: row.id,
        sectionHeader: 'Draft numeric overrides',
        text: escapeHtml(plainText(row.name || 'Unsupported effect override')),
        draftCondition: plainText(row.condition),
        draftTarget: row.target,
        atkStep: targetApplies && ['atk', 'both'].includes(row.stat) ? numeric(row.value) : 0,
        defStep: targetApplies && timing !== 'within' && ['def', 'both'].includes(row.stat) ? numeric(row.value) : 0,
        drStep: 0,
        phase: timing === 'p2' ? 'p2' : 'sot',
        isOnSaWithinTurn: timing === 'within',
        active: !!row.active && targetApplies,
        draftActive: !!row.active,
        isConditional: !!row.condition,
        hasStatImpact: targetApplies && numeric(row.value) !== 0,
        isStacking: false,
        stackCount: 1,
        maxPctCap: 0,
        isAllySupportOnly: row.target === 'allies-excluded',
        isEnemyTargeted: row.target === 'enemy'
    };
}

export function runtimeSaBlocks(draft) {
    return draft.saBlocks.map((source, index) => {
        const sa = clone(source);
        const selfTarget = sa.draftTarget === 'self' || sa.draftTarget === 'allies-including-self';
        const currentAtkOverride = selfTarget ? stageTotal(draft, 'sa-current', 'atk', index) : 0;
        const currentDefOverride = selfTarget ? stageTotal(draft, 'sa-current', 'def', index) : 0;
        const turnAtkOverride = selfTarget ? stageTotal(draft, 'sa-turn', 'atk', index) : 0;
        const turnDefOverride = selfTarget ? stageTotal(draft, 'sa-turn', 'def', index) : 0;
        const turnAtk = selfTarget ? numeric(sa.draftTurnAtk) + turnAtkOverride : 0;
        const atk = selfTarget ? numeric(sa.draftAtk) + currentAtkOverride + turnAtk : 0;
        const def = selfTarget ? numeric(sa.draftDef) + currentDefOverride : 0;
        sa.saName = escapeHtml(sa.draftNameText);
        sa.typeLabel = escapeHtml(sa.draftTypeLabel || 'Super Attack');
        sa.fullText = escapeHtml(sa.draftFullText);
        sa.activationText = escapeHtml(sa.draftConditionText);
        sa.condition = escapeHtml(sa.draftConditionText);
        sa.is_ex = !!sa.draftIsEx;
        sa.is_unit_sa = !!sa.draftIsUnit;
        sa.startKi = numeric(sa.draftStartKi);
        sa.eball_num_start = numeric(sa.draftStartKi);
        sa.endKi = numeric(sa.draftEndKi);
        sa.eball_num_end = numeric(sa.draftEndKi);
        sa.exact_multiplier = numeric(sa.draftMultiplier);
        sa.eff = { ...(sa.eff || {}), atk, def };
        sa.draftBaseTurnAtk = numeric(sa.draftTurnAtk);
        sa.draftBaseTurnDef = numeric(sa.draftTurnDef);
        sa.draftTurnAtk = turnAtk;
        sa.draftTurnDef = selfTarget ? numeric(sa.draftTurnDef) + turnDefOverride : 0;
        sa.draftAtk = numeric(sa.draftAtk);
        sa.draftDef = numeric(sa.draftDef);
        // Preserve the calculator's prior carry behavior while keeping selected-SA DEF targeting explicit.
        sa.draftAtkTiming = sa.draftAtkTiming === 'source' ? 'current-turn' : sa.draftAtkTiming || 'current';
        sa.draftConditionRequired = !!sa.draftConditionRequired;
        sa.draftConditionMet = !sa.draftConditionRequired || !!sa.draftConditionMet;
        return sa;
    });
}

function renderSaControlValues(blocks) {
    blocks.forEach((sa, index) => {
        const atk = document.getElementById(`calc-sa-atk-effect-${index}`);
        const def = document.getElementById(`calc-sa-def-effect-${index}`);
        const multiplier = document.getElementById(`calc-sa-type-${index}`);
        if (atk) atk.value = String(sa.eff?.atk ?? 0);
        if (def) def.value = String(sa.eff?.def ?? 0);
        if (multiplier) multiplier.value = String(sa.exact_multiplier ?? sa.draftMultiplier ?? 0);
        const atkYield = document.getElementById(`sa-atk-eff-yield-${index}`);
        const defYield = document.getElementById(`sa-def-eff-yield-${index}`);
        if (atkYield) atkYield.textContent = `+${numeric(sa.eff?.atk)}% ATK`;
        if (defYield) defYield.textContent = `+${numeric(sa.eff?.def)}% DEF`;
    });
}

function applyEntry(entry, draft = entry.applied, { render = false, forceLinks = false } = {}) {
    if (!draft) return;
    window.currentCalcType = draft.profile.type;
    window.currentCalcClass = draft.profile.class;
    window.currentCalcRarity = draft.profile.rarity;
    window.currentCalcEza = draft.profile.awakening !== 'base';
    window.currentHpPercent = draft.currentHpPercent;
    window.activeUnitSaBlockIdx = draft.activeUnitSaBlockIdx;
    window.exToggleState = clone(draft.exToggleState || {});

    Object.entries(draft.controls).forEach(([id, control]) => {
        if (SKIP_CONTROL_IDS.has(id) || id.startsWith('calc-sa-')) return;
        if (STAT_CONTROL_IDS.has(id) || control.kind === 'checkbox') writeControlValue(id, control.kind === 'checkbox' ? control.checked : control.value);
    });

    const domainAtk = numeric(controlValue(draft.controls, 'calc-domain-atk')) + stageTotal(draft, 'domain', 'atk');
    const domainDef = numeric(controlValue(draft.controls, 'calc-domain-def')) + stageTotal(draft, 'domain', 'def');
    const activeAtk = numeric(controlValue(draft.controls, 'calc-active-atk')) + stageTotal(draft, 'active', 'atk');
    const activeDef = numeric(controlValue(draft.controls, 'calc-active-def')) + stageTotal(draft, 'active', 'def');
    writeControlValue('calc-domain-atk', domainAtk);
    writeControlValue('calc-domain-def', domainDef);
    writeControlValue('calc-active-atk', activeAtk);
    writeControlValue('calc-active-def', activeDef);

    if (forceLinks) {
        window.calcDraftUiBridge?.setLinks?.(clone(draft.links).map(link => ({ ...link, name: escapeHtml(link.name) })));
    }
    const linkAtk = sumActiveLinks(draft.links, 'atk') + numeric(draft.manualLinkAtk) + stageTotal(draft, 'links', 'atk');
    const linkDef = sumActiveLinks(draft.links, 'def') + numeric(draft.manualLinkDef) + stageTotal(draft, 'links', 'def');
    writeControlValue('calc-link-atk', linkAtk);
    writeControlValue('calc-link-def', linkDef);

    const sas = runtimeSaBlocks(draft);
    window.lastParsedSaBlocksData = sas;
    window.lastParsedSaBlocksData.__calculatorDraftKey = currentKey;
    window.interactivePassiveLines = draft.passiveLines.map((line, index) => materializePassiveLine(line, index));
    const stageRows = (draft.stageOverrides || [])
        .filter(row => ['start', 'attack', 'within'].includes(row.stage))
        .map((row, index) => materializeStageLine(row, window.interactivePassiveLines.length + index));
    window.interactivePassiveLines.push(...stageRows);

    if (render) {
        window.calcDraftUiBridge?.renderSaRows?.(sas);
        window.calcDraftUiBridge?.refreshPassiveRows?.();
    } else {
        renderSaControlValues(sas);
    }
    if (render || forceLinks) {
        window.syncLeaderPillsFromInput?.();
    }
    const nameElement = document.getElementById('sc-name');
    if (nameElement) nameElement.textContent = draft.profile.name;
}

function getCurrentMeta() {
    return window.currentLoadedCardMeta || null;
}

function entryForCurrentCard({ create = false } = {}) {
    const meta = getCurrentMeta();
    if (!meta) return null;
    const key = makeCalculatorDraftKey(meta, window.currentCalcEzaMode || 'base');
    let entry = entries.get(key);
    if (!entry && create) {
        entry = createEntry(meta);
        entries.set(key, entry);
    }
    return entry ? { key, entry } : { key, entry: null };
}

function supportedControlsSection(entry) {
    const details = createSection('Base stats and calculation inputs', 'The source values below seed this card’s draft. Inputs map to calculator stages that already exist.', true);
    const ids = [
        ['calc-base-atk', 'Base ATK', 'number'], ['calc-base-def', 'Base DEF', 'number'], ['calc-lead', 'Leader skill multiplier', 'number'],
        ['calc-sot-atk', 'Start-of-turn ATK', 'number'], ['calc-sot-def', 'Start-of-turn DEF', 'number'],
        ['calc-p2-atk', 'Attacking-phase ATK', 'number'], ['calc-p2-def', 'Attacking-phase DEF', 'number'],
        ['calc-ki-slider', 'Current Ki', 'number'], ['calc-ki-mult-base', 'High-Ki SA multiplier', 'number'], ['calc-ki-mult-add', 'Low-Ki SA multiplier', 'number'],
        ['calc-orbs-master-toggle', 'Apply skill orb stats', 'checkbox'], ['calc-orb-atk', 'Skill orb ATK', 'number'], ['calc-orb-def', 'Skill orb DEF', 'number'],
        ['calc-hit-stacks-slider', 'Hit-based stack count', 'number'], ['calc-passive-hp-slider', 'Current HP %', 'number'],
        ['calc-sa-hipo-boost', 'Hidden Potential SA bonus', 'number'], ['calc-prev-sa-stacks', 'Prior SA stacks', 'number'],
        ['calc-dr', 'Direct damage reduction %', 'number'], ['calc-guard', 'Guard against all attacks', 'checkbox']
    ];
    ids.forEach(([id, label, type]) => {
        if (!document.getElementById(id)) return;
        details.body.append(fieldForControl(id, label, type, entry));
    });
    return details.root;
}

function profileSection(entry) {
    const details = createSection('Card profile', 'Draft metadata affects calculator interpretation only. Categories are notes; teammate membership is checked manually.', false);
    const profile = entry.draft.profile;
    const specs = [
        ['name', 'Character name', 'text'],
        ['type', 'Type', 'select', ['AGL', 'TEQ', 'INT', 'STR', 'PHY']],
        ['class', 'Class', 'select', ['Super', 'Extreme']],
        ['rarity', 'Rarity', 'select', ['TUR', 'LR']],
        ['awakening', 'Awakening stage', 'select', ['base', 'eza', 'seza']],
        ['categories', 'Categories (comma-separated)', 'text']
    ];
    specs.forEach(([key, label, type, options]) => {
        const control = type === 'select' ? createSelect(options, profile[key]) : createInput(type, profile[key]);
        control.dataset.draftScope = 'profile';
        control.dataset.draftField = key;
        control.setAttribute('aria-label', label);
        details.body.append(field(label, control, entry.source.profile?.[key] ?? '—'));
    });
    return details.root;
}

function bracketSection(entry) {
    const details = createSection('Active skill and Domain', 'These values use the calculator’s existing brackets and activation switches.', false);
    const specs = [
        ['calc-active-skill-active', 'Active skill is active', 'checkbox'],
        ['calc-active-sa-type', 'Active skill attack multiplier', 'select'],
        ['calc-active-temp-atk', 'Active Skill ATK multiplier', 'number'],
        ['calc-active-atk', 'Active skill ATK', 'number'], ['calc-active-def', 'Active skill DEF', 'number'],
        ['calc-domain-active', 'Domain is active', 'checkbox'],
        ['calc-domain-atk', 'Domain ATK', 'number'], ['calc-domain-def', 'Domain DEF', 'number']
    ];
    specs.forEach(([id, label, type]) => {
        if (document.getElementById(id)) details.body.append(fieldForControl(id, label, type, entry));
    });
    return details.root;
}

function linksSection(entry) {
    const details = createSection('Link skills', 'Edit link stats and whether each link is active. Values are local to this card and form.', false);
    const list = createEl('div', 'calc-draft-list');
    entry.draft.links.forEach((link, index) => list.append(linkEditorRow(link, index, entry)));
    details.body.append(list);
    details.body.append(actionButton('Add link', 'add-link'));
    return details.root;
}

function passiveSection(entry) {
    const details = createSection('Passive effects and conditions', 'Condition checks are manual. Teammate buffs marked as excluded do not affect this character’s own stats.', false);
    const list = createEl('div', 'calc-draft-list');
    entry.draft.passiveLines.forEach((line, index) => list.append(passiveEditorRow(line, index, entry)));
    details.body.append(list);
    details.body.append(actionButton('Add passive effect', 'add-passive'));
    return details.root;
}

function saSection(entry) {
    const details = createSection('Super Attacks', 'The first effect applies to this attack. Current-turn raises also carry into later attacks this turn. Ally support is recorded but excluded from the user’s own ATK/DEF.', false);
    const list = createEl('div', 'calc-draft-list');
    entry.draft.saBlocks.forEach((sa, index) => list.append(saEditorRow(sa, index, entry)));
    details.body.append(list);
    details.body.append(actionButton('Add Super Attack', 'add-sa'));
    return details.root;
}

function stageOverrideSection(entry) {
    const details = createSection('Unsupported effect stage overrides', 'Use only the unparsed amount. Values add to parsed controls at the selected stage, so avoid entering the same effect twice.', false);
    const list = createEl('div', 'calc-draft-list');
    entry.draft.stageOverrides.forEach((row, index) => list.append(stageEditorRow(row, index, entry)));
    details.body.append(list);
    details.body.append(actionButton('Add numeric override', 'add-stage'));
    return details.root;
}

function limitsSection(entry) {
    const details = createSection('Standby and simulation notes', 'The engine does not simulate standby transformations, finish attacks, or automatic teammate/category checks. Add notes here and model supported ATK/DEF effects with numeric stage overrides.', false);
    const note = createEl('textarea', 'calc-draft-textarea');
    note.value = entry.draft.standbyNotes || '';
    note.dataset.draftScope = 'draft';
    note.dataset.draftField = 'standbyNotes';
    note.setAttribute('aria-label', 'Standby and unsupported mechanic notes');
    details.body.append(field('Notes', note, 'No source notes'));
    const summary = createEl('p', 'calc-draft-help', 'Parsed ATK/DEF, passive stacks, links, active skills, Domain, Ki, Super Attack multipliers, and within-turn raises feed the calculation. Critical hits, dodge, nullification, and standby finish sequences are not modeled as numeric damage stages.');
    details.body.append(summary);
    return details.root;
}

function buildEditor(entry) {
    const editor = document.getElementById(EDITOR_ID);
    if (!editor) return;
    editor.replaceChildren(
        profileSection(entry),
        supportedControlsSection(entry),
        bracketSection(entry),
        linksSection(entry),
        passiveSection(entry),
        saSection(entry),
        stageOverrideSection(entry),
        limitsSection(entry)
    );
    ['profile', 'stats', 'active', 'links', 'passive', 'super', 'advanced', 'notes'].forEach((section, index) => {
        editor.children[index].dataset.draftSection = section;
    });
}

export function readDraftPassivePercentages(text) {
    const value = plainText(text);
    // One effect/target per row: do not flatten conditional or stacking clauses.
    if (/\b(?:when|if|per|every|each|up to|depending|enemy|enemies|allies|receiv\w*|perform\w*|additional|reduces?|lowers?|decreases?)\b/i.test(value)) return null;
    const matches = [...value.matchAll(/\b(ATK(?:\s*(?:&|and)\s*DEF)?|DEF(?:\s*(?:&|and)\s*ATK)?)\s*(?:by\s*)?\+?\s*(\d+(?:\.\d+)?)\s*%/gi)];
    if (!matches.length) return null;
    const result = { draftAtk: 0, draftDef: 0 };
    const seen = new Set();
    for (const match of matches) {
        for (const stat of ['ATK', 'DEF']) {
            if (!match[1].toUpperCase().includes(stat)) continue;
            if (seen.has(stat)) return null;
            seen.add(stat);
            result[stat === 'ATK' ? 'draftAtk' : 'draftDef'] = Number(match[2]);
        }
    }
    return result;
}

function handleDraftField(event) {
    const input = event.target?.closest?.('[data-draft-scope]');
    if (!input) return;
    const info = entryForCurrentCard();
    if (!info?.entry) return;
    const { entry, key } = info;
    const value = input.type === 'checkbox' ? !!input.checked : input.value;
    const scope = input.dataset.draftScope;
    const index = Number(input.dataset.draftIndex);
    const fieldName = input.dataset.draftField;
    if (scope === 'control') {
        const id = input.dataset.controlId;
        if (!id || !entry.draft.controls[id]) return;
        const control = entry.draft.controls[id];
        if (control.kind === 'checkbox') control.checked = value;
        else control.value = value;
        if (id === 'calc-passive-hp-slider') entry.draft.currentHpPercent = numeric(value);
    } else if (scope === 'profile') entry.draft.profile[fieldName] = value;
    else if (scope === 'draft') entry.draft[fieldName] = value;
    else if (scope === 'passive') {
        const line = entry.draft.passiveLines[index];
        if (line) {
            line[fieldName] = value;
            if (fieldName === 'draftText') {
                const parsed = readDraftPassivePercentages(value);
                const card = input.closest('.calc-draft-card');
                const status = card?.querySelector('.calc-draft-parse-status');
                if (parsed) {
                    Object.assign(line, parsed);
                    for (const [key, amount] of Object.entries(parsed)) {
                        const control = document.querySelector(`[data-draft-scope="passive"][data-draft-index="${index}"][data-draft-field="${key}"]`);
                        if (control) control.value = String(amount);
                    }
                }
                if (status) status.textContent = parsed
                    ? `Read from text: ATK ${parsed.draftAtk}%, DEF ${parsed.draftDef}%. Apply to calculate.`
                    : 'Review advanced values: this wording cannot be read automatically. Previous values are retained.';
            }
        }
    } else if (scope === 'sa') {
        const sa = entry.draft.saBlocks[index];
        if (sa) sa[fieldName] = value;
    } else if (scope === 'link') {
        const link = entry.draft.links[index];
        if (link) link[fieldName] = input.type === 'checkbox' ? value : fieldName === 'name' ? value : numeric(value);
    } else if (scope === 'stage') {
        const row = entry.draft.stageOverrides[index];
        if (row) row[fieldName] = ['active'].includes(fieldName) ? value : ['name', 'condition', 'stage', 'stat', 'target'].includes(fieldName) ? value : numeric(value);
    }
    entry.draft.dirty = true;
    currentKey = key;
    clearDraftValidation();
    updateShell(entry);
}

function addEditorRow(action) {
    const info = entryForCurrentCard();
    if (!info?.entry) return;
    const { entry, key } = info;
    const draft = entry.draft;
    if (action === 'add-link') {
        draft.links.push({ name: 'Draft link', atk: 0, def: 0, ki: 0, active: true, rawObj: null });
    } else if (action === 'add-passive') {
        const nextIdx = Math.max(0, ...draft.passiveLines.map(line => numeric(line.idx))) + 1;
        draft.passiveLines.push(normalizePassiveLine({
            idx: nextIdx, sectionHeader: 'Draft additions', text: 'Draft passive effect',
            draftText: 'Draft passive effect', draftCondition: '', draftTarget: 'self',
            draftAtk: 0, draftDef: 0, draftTiming: 'start', draftStackCount: 1,
            draftMaxPctCap: 0, draftActive: true, draftStacking: false, active: true,
            atkStep: 0, defStep: 0, phase: 'sot', isOnSaWithinTurn: false,
            hasStatImpact: true, isConditional: false
        }, nextIdx));
    } else if (action === 'add-sa') {
        const index = draft.saBlocks.length;
        draft.saBlocks.push(normalizeSaBlock({
            typeLabel: 'Super Attack', saName: `Draft Super Attack ${index + 1}`,
            fullText: '', condition: '', activationText: '', is_ex: false, is_unit_sa: false,
            startKi: 12, eball_num_start: 12, exact_multiplier: 505, eff: { atk: 0, def: 0 },
            draftConditionRequired: false, draftConditionMet: true, draftAtk: 0, draftDef: 0
        }, index));
    } else if (action === 'add-stage') {
        draft.stageOverrides.push({
            id: `stage-${Date.now()}-${draft.stageOverrides.length}`,
            name: 'Unsupported effect', condition: '', stage: 'start', stat: 'atk', value: 0,
            target: 'self', active: true, saIndex: 0
        });
    } else if (action.startsWith('remove-')) {
        const index = Number(action.split(':')[1]);
        const listName = action.split(':')[0].replace('remove-', '');
        if (listName === 'link') draft.links.splice(index, 1);
        if (listName === 'passive') draft.passiveLines.splice(index, 1);
        if (listName === 'sa') draft.saBlocks.splice(index, 1);
        if (listName === 'stage') draft.stageOverrides.splice(index, 1);
    }
    draft.dirty = true;
    currentKey = key;
    buildEditor(entry);
    updateShell(entry);
}

function validateDraft(entry) {
    const editor = document.getElementById(EDITOR_ID);
    const error = document.getElementById(ERROR_ID);
    if (!editor || !error) return true;
    editor.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));
    const invalidNumber = Array.from(editor.querySelectorAll('input[type="number"]')).find(control =>
        control.value.trim() === '' || !Number.isFinite(Number(control.value)) || !control.checkValidity()
    );
    let message = '';
    let invalidControl = invalidNumber || null;
    if (invalidNumber) {
        const label = invalidNumber.closest('.calc-draft-field')?.querySelector('label')?.textContent || 'A numeric field';
        message = `${label} must contain a valid number.`;
    } else if (!plainText(entry.draft.profile.name)) {
        invalidControl = editor.querySelector('[data-draft-scope="profile"][data-draft-field="name"]');
        message = 'Character name is required.';
    } else if (entry.draft.saBlocks.length === 0) {
        message = 'Add at least one Super Attack before applying this draft.';
    }
    for (const sa of entry.draft.saBlocks) {
        const required = hasAllyCondition(sa.draftConditionText);
        if (required && !sa.draftConditionRequired) sa.draftConditionMet = false;
        if (!required) sa.draftConditionMet = true;
        sa.draftConditionRequired = required;
        const startKi = Number(sa.draftStartKi);
        const endKi = Number(sa.draftEndKi);
        if (!message && (!Number.isInteger(startKi) || startKi < 1 || startKi > 24)) {
            invalidControl = editor.querySelector(`[data-draft-scope="sa"][data-draft-index="${entry.draft.saBlocks.indexOf(sa)}"][data-draft-field="draftStartKi"]`);
            message = 'Starting Ki must be a whole number from 1 to 24.';
        } else if (!message && (!Number.isInteger(endKi) || endKi < 0 || endKi > 24)) {
            invalidControl = editor.querySelector(`[data-draft-scope="sa"][data-draft-index="${entry.draft.saBlocks.indexOf(sa)}"][data-draft-field="draftEndKi"]`);
            message = 'Ending Ki must be 0 or a whole number from 1 to 24.';
        }
    }
    error.textContent = message;
    error.hidden = !message;
    if (invalidControl && message) {
        invalidControl.setAttribute('aria-invalid', 'true');
        invalidControl.focus();
        invalidControl.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
    return !message;
}

function clearDraftValidation() {
    const error = document.getElementById(ERROR_ID);
    if (error) {
        error.textContent = '';
        error.hidden = true;
    }
    document.getElementById(EDITOR_ID)?.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));
}

function commitCurrentDraft({ close = true } = {}) {
    const info = entryForCurrentCard();
    if (!info?.entry || !validateDraft(info.entry)) return false;
    const { entry, key } = info;
    currentKey = key;
    entry.applied = clone(entry.draft);
    entry.applied.dirty = false;
    entry.draft.dirty = false;
    applyEntry(entry, entry.applied, { render: true, forceLinks: true });
    if (close) closeDraftEditor();
    updateShell(entry);
    window.calculateDokkanStats?.();
    return true;
}

function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = createEl('style');
    style.id = STYLE_ID;
    style.textContent = `
        #${PANEL_ID}, #${DRAWER_ID} {
            --calc-draft-accent: var(--theme-border, var(--theme-main, currentColor));
            --calc-draft-ink: var(--theme-text, currentColor);
            --calc-draft-muted: color-mix(in srgb, var(--calc-draft-ink) 76%, var(--calc-draft-surface));
            --calc-draft-surface: color-mix(in srgb, var(--theme-bg-high, var(--theme-bg-low, transparent)) 72%, var(--theme-bg-low, transparent));
            --calc-draft-surface-raised: color-mix(in srgb, var(--theme-bg-high, var(--theme-bg-low, transparent)) 82%, var(--theme-bg-low, transparent));
            --calc-draft-border: color-mix(in srgb, var(--calc-draft-accent) 30%, var(--abs-liquid-border, currentColor));
        }
        #${PANEL_ID} { box-sizing: border-box; }
        #${PANEL_ID} .calc-draft-title { margin: 0 0 9px !important; }
        #${PANEL_ID} .calc-draft-toggle-row {
            align-items: center; background: var(--calc-draft-surface); border: 1px solid var(--calc-draft-border);
            border-radius: 10px; cursor: pointer; display: flex; gap: 10px; justify-content: space-between;
            min-height: 48px; padding: 9px 11px; transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        #${PANEL_ID} .calc-draft-toggle-row:hover { border-color: color-mix(in srgb, var(--calc-draft-accent) 64%, var(--calc-draft-border)); }
        #${PANEL_ID} .calc-draft-toggle-row.is-enabled {
            background: color-mix(in srgb, var(--calc-draft-accent) 11%, var(--calc-draft-surface));
            border-color: color-mix(in srgb, var(--calc-draft-accent) 70%, var(--calc-draft-border));
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--calc-draft-accent) 20%, transparent);
        }
        #${PANEL_ID} .calc-draft-toggle-row input {
            appearance: none; background: color-mix(in srgb, var(--calc-draft-ink) 18%, transparent);
            border: 1px solid color-mix(in srgb, var(--calc-draft-ink) 34%, transparent); border-radius: 999px;
            cursor: pointer; flex: 0 0 42px; height: 24px; margin: 0; position: relative; transition: background .18s ease, border-color .18s ease;
            width: 42px;
        }
        #${PANEL_ID} .calc-draft-toggle-row input::after {
            background: var(--calc-draft-ink); border-radius: 50%; content: ''; height: 16px; left: 3px; position: absolute;
            top: 3px; transition: background .18s ease, transform .18s ease; width: 16px;
        }
        #${PANEL_ID} .calc-draft-toggle-row input:checked { background: color-mix(in srgb, var(--calc-draft-accent) 58%, var(--theme-bg-low, transparent)); border-color: var(--calc-draft-accent); }
        #${PANEL_ID} .calc-draft-toggle-row input:checked::after { background: var(--theme-text, currentColor); transform: translateX(18px); }
        #${PANEL_ID} .calc-draft-toggle-row input:focus-visible { outline: 2px solid var(--calc-draft-accent); outline-offset: 3px; }
        #${PANEL_ID} .calc-draft-toggle-row input:disabled { cursor: not-allowed; opacity: .55; }
        #${PANEL_ID} .calc-draft-toggle-copy { align-items: center; display: flex; flex: 1; justify-content: space-between; gap: 8px; }
        #${PANEL_ID} .calc-draft-toggle-label { color: var(--calc-draft-ink); font-size: 12px; font-weight: 800; line-height: 1.3; }
        #${PANEL_ID} .calc-draft-toggle-state { background: color-mix(in srgb, var(--calc-draft-ink) 9%, transparent); border: 1px solid var(--calc-draft-border); border-radius: 999px; color: var(--calc-draft-muted); font-size: 10px; font-weight: 800; letter-spacing: .04em; min-width: 38px; padding: 3px 7px; text-align: center; text-transform: uppercase; }
        #${PANEL_ID} .calc-draft-toggle-row.is-enabled .calc-draft-toggle-state { background: color-mix(in srgb, var(--calc-draft-accent) 18%, var(--calc-draft-surface)); border-color: var(--calc-draft-accent); color: var(--calc-draft-ink); }
        #${PANEL_ID} .calc-draft-status { color: var(--calc-draft-muted); font-size: 11px; line-height: 1.45; margin: 9px 0 0; }
        #${PANEL_ID} .calc-draft-toolbar, #${DRAWER_ID} .calc-draft-toolbar { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
        #${PANEL_ID} .calc-draft-toolbar { display: grid; grid-template-columns: minmax(0,1fr) auto; margin: 10px 0 0; }
        #${PANEL_ID} .calc-draft-toolbar .sba-gui-btn, #${DRAWER_ID} .calc-draft-toolbar .sba-gui-btn {
            align-items: center !important; display: inline-flex !important; flex-direction: row !important; font: inherit !important;
            font-size: 11px !important; font-weight: 800 !important; gap: 6px !important; justify-content: center !important;
            min-height: 38px !important; padding: 7px 10px !important; text-decoration: none !important; width: auto !important;
        }
        #${PANEL_ID} .calc-draft-open { flex: 1 1 auto; }
        #${PANEL_ID} .calc-draft-reset { color: var(--calc-draft-muted) !important; }
        #${PANEL_ID} button:disabled, #${DRAWER_ID} button:disabled { cursor: not-allowed !important; opacity: .48 !important; transform: none !important; }
        #${WORKSPACE_ID}.calc-draft-open { align-items: start; display: grid; gap: 16px; grid-template-columns: minmax(0,1fr) minmax(390px, 460px); margin: 15px auto 60px; max-width: 1560px; width: 95vw; }
        #${WORKSPACE_ID}.calc-draft-open #calculator-view { box-sizing: border-box; grid-column: 1; grid-row: 1; margin: 0; max-width: none; min-width: 0; width: 100%; }
        #${DRAWER_ID} {
            background: linear-gradient(180deg, color-mix(in srgb, var(--theme-bg-high, var(--theme-bg-low, transparent)) 94%, var(--theme-bg-low, transparent)), color-mix(in srgb, var(--theme-bg-low, transparent) 98%, var(--theme-bg-high, transparent)));
            backdrop-filter: blur(18px) saturate(145%); -webkit-backdrop-filter: blur(18px) saturate(145%);
            border: 1px solid var(--calc-draft-border); border-radius: 12px; box-shadow: 0 18px 48px rgba(0,0,0,.3), inset 0 1px 0 color-mix(in srgb, var(--calc-draft-ink) 10%, transparent);
            box-sizing: border-box; color: var(--calc-draft-ink); display: flex; flex-direction: column; grid-column: 2; grid-row: 1;
            height: calc(100vh - 156px); max-height: calc(100vh - 156px); height: calc(100dvh - 156px); max-height: calc(100dvh - 156px);
            min-height: 0; min-width: 0; overflow: hidden; position: fixed; right: max(calc((100vw - 1560px) / 2), 2.5vw); top: 84px; width: min(460px, 46vw);
        }
        #${DRAWER_ID}[hidden] { display: none !important; }
        #${DRAWER_ID} .calc-draft-drawer-header { align-items: center; border-bottom: 1px solid var(--calc-draft-border); display: flex; flex: 0 0 auto; justify-content: space-between; padding: 13px 15px; }
        #${DRAWER_ID} .calc-draft-drawer-title { color: var(--calc-draft-ink); font-size: 15px; font-weight: 850; letter-spacing: .01em; margin: 0; }
        #${DRAWER_ID} .calc-draft-close { align-items: center; appearance: none; background: color-mix(in srgb, var(--calc-draft-ink) 6%, transparent); border: 1px solid var(--calc-draft-border); border-radius: 8px; color: var(--calc-draft-ink); cursor: pointer; display: inline-flex; font: inherit; font-size: 14px; height: 34px; justify-content: center; width: 36px; }
        #${DRAWER_ID} .calc-draft-close:hover { background: color-mix(in srgb, var(--calc-draft-accent) 16%, transparent); border-color: var(--calc-draft-accent); }
        #${DRAWER_ID} .calc-draft-toolbar { background: color-mix(in srgb, var(--theme-bg-low, transparent) 42%, transparent); border-bottom: 1px solid var(--calc-draft-border); flex: 0 0 auto; margin: 0; padding: 10px 14px; }
        #${DRAWER_ID} .calc-draft-reset { margin-right: auto; color: var(--calc-draft-muted) !important; }
        #${DRAWER_ID} .calc-draft-apply { background: color-mix(in srgb, var(--calc-draft-accent) 27%, var(--theme-bg-low, transparent)) !important; border-color: color-mix(in srgb, var(--calc-draft-accent) 70%, var(--calc-draft-border)) !important; box-shadow: 0 0 0 1px color-mix(in srgb, var(--calc-draft-accent) 18%, transparent), inset 0 1px 0 color-mix(in srgb, var(--calc-draft-ink) 18%, transparent) !important; color: var(--calc-draft-ink) !important; flex: 1 1 150px; }
        #${DRAWER_ID} .calc-draft-apply:hover { background: color-mix(in srgb, var(--calc-draft-accent) 38%, var(--theme-bg-low, transparent)) !important; border-color: var(--calc-draft-accent) !important; }
        #${ERROR_ID} { background: color-mix(in srgb, #ef4444 12%, var(--theme-bg-low, transparent)); border: 1px solid color-mix(in srgb, #ef4444 56%, var(--calc-draft-border)); border-radius: 8px; color: var(--calc-draft-ink); font-size: 12px; line-height: 1.4; margin: 10px 14px 0; padding: 9px 11px; }
        #${ERROR_ID}[hidden] { display: none !important; }
        #${EDITOR_ID} {
            align-content: start; display: grid; flex: 1 1 auto; gap: 10px; min-height: 0; min-width: 0;
            overflow-x: hidden; overflow-y: auto; overscroll-behavior-y: auto; padding: 12px 14px 16px;
            scrollbar-color: var(--calc-draft-border) transparent; scrollbar-gutter: stable; touch-action: pan-y; -webkit-overflow-scrolling: touch;
        }
        #${EDITOR_ID}[hidden] { display: none; }
        #${EDITOR_ID} [aria-invalid="true"] { border-color: #ef4444 !important; box-shadow: 0 0 0 3px color-mix(in srgb, #ef4444 24%, transparent); }
        #${EDITOR_ID} details { background: color-mix(in srgb, var(--calc-draft-surface-raised) 88%, var(--calc-draft-surface)); border: 1px solid var(--calc-draft-border); border-radius: 10px; color: var(--calc-draft-ink); min-width: 0; overflow: visible; padding: 0 11px 11px; position: relative; }
        #${EDITOR_ID} details:focus-within { z-index: 1; }
        #${EDITOR_ID} details > div { min-height: 0; min-width: 0; }
        #${EDITOR_ID} summary { align-items: center; color: var(--calc-draft-ink); cursor: pointer; display: flex; font-size: 11px; font-weight: 850; gap: 10px; justify-content: space-between; letter-spacing: .045em; list-style: none; padding: 12px 1px; text-transform: uppercase; }
        #${EDITOR_ID} summary::after { color: var(--calc-draft-accent); content: '⌄'; font-size: 15px; line-height: 1; transition: transform .16s ease; }
        #${EDITOR_ID} details[open] > summary { border-bottom: 1px solid var(--calc-draft-border); margin-bottom: 9px; }
        #${EDITOR_ID} details[open] > summary::after { transform: rotate(180deg); }
        #${EDITOR_ID} summary::-webkit-details-marker { display: none; }
        #${EDITOR_ID} summary:focus-visible, #${DRAWER_ID} button:focus-visible, #${PANEL_ID} .sba-gui-btn:focus-visible,
        #${EDITOR_ID} :is(input,select,textarea,button):focus-visible { outline: 2px solid var(--calc-draft-accent); outline-offset: 2px; }
        #${EDITOR_ID} .calc-draft-help { color: var(--calc-draft-muted); font-size: 11px; line-height: 1.5; margin: 7px 0; }
        #${EDITOR_ID} .calc-draft-field { display: grid; gap: 5px; margin: 9px 0; min-width: 0; }
        #${EDITOR_ID} .calc-draft-field > label { color: var(--calc-draft-ink); font-size: 11px; font-weight: 750; }
        #${EDITOR_ID} .calc-draft-field input, #${EDITOR_ID} .calc-draft-field select, #${EDITOR_ID} .calc-draft-field textarea {
            background: color-mix(in srgb, var(--theme-bg-low, #101827) 35%, #030710 65%); border: 1px solid var(--calc-draft-border);
            border-radius: 8px; box-sizing: border-box; color: var(--calc-draft-ink); font: inherit; font-size: 12px;
            min-height: 36px; min-width: 0; padding: 7px 9px; transition: border-color .16s ease, box-shadow .16s ease, background .16s ease; width: 100%;
        }
        #${EDITOR_ID} .calc-draft-field select { appearance: auto; max-width: 100%; }
        #${EDITOR_ID} .calc-draft-field select option { background: var(--theme-bg-low, var(--calc-draft-surface)); color: var(--theme-text, currentColor); }
        #${EDITOR_ID} .calc-draft-field :is(input,select,textarea):focus-visible { background: var(--calc-draft-surface); border-color: var(--calc-draft-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--calc-draft-accent) 20%, transparent); outline: 0; }
        #${EDITOR_ID} .calc-draft-field textarea { min-height: 78px; resize: vertical; }
        #${EDITOR_ID} .calc-draft-source { color: var(--calc-draft-muted); font-size: 10px; line-height: 1.4; }
        #${EDITOR_ID} .calc-draft-grid { display: grid; gap: 8px; grid-template-columns: repeat(2,minmax(0,1fr)); }
        #${EDITOR_ID} .calc-draft-card { background: color-mix(in srgb, var(--theme-bg-low, transparent) 46%, var(--calc-draft-surface)); border: 1px solid var(--calc-draft-border); border-radius: 9px; margin: 9px 0; padding: 10px; }
        #${EDITOR_ID} .calc-draft-card-title { color: var(--calc-draft-ink); font-size: 11px; font-weight: 850; letter-spacing: .02em; margin: 0 0 6px; }
        #${EDITOR_ID} .calc-draft-check { align-items: center; color: var(--calc-draft-ink); display: flex; font-size: 11px; gap: 8px; margin: 9px 0; }
        #${EDITOR_ID} .calc-draft-check input { accent-color: var(--calc-draft-accent); height: 16px; width: 16px; }
        #${EDITOR_ID} .calc-draft-remove { border-color: color-mix(in srgb, #ef4444 35%, var(--calc-draft-border)) !important; color: color-mix(in srgb, #ef4444 72%, var(--calc-draft-ink)) !important; margin-top: 5px; }
        #${BANNER_ID} { background: color-mix(in srgb, var(--theme-border, currentColor) 11%, var(--theme-bg-low, transparent)); border: 1px solid color-mix(in srgb, var(--theme-border, currentColor) 38%, var(--abs-liquid-border, currentColor)); border-left: 3px solid var(--theme-border, currentColor); border-radius: 9px; color: var(--theme-text, currentColor); font-size: 11px; font-weight: 750; line-height: 1.45; margin: 8px auto; max-width: 1280px; padding: 9px 12px; }
        #${BANNER_ID}[hidden] { display: none; }
        @media (max-width: 1100px) {
            #${WORKSPACE_ID}.calc-draft-open { grid-template-columns: minmax(0,1fr); width: min(95vw, 760px); }
            #${WORKSPACE_ID}.calc-draft-open #calculator-view { grid-column: 1; grid-row: 2; }
            #${DRAWER_ID} { grid-column: 1; grid-row: 1; height: auto; max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); position: static; right: auto; top: auto; width: 100%; }
            #${EDITOR_ID} { flex: 1 1 auto; max-height: min(56vh, 560px); max-height: min(56dvh, 560px); }
        }
        @media (max-width: 600px) {
            #${WORKSPACE_ID}.calc-draft-open { gap: 10px; width: calc(100% - 16px); }
            #${DRAWER_ID} { border-radius: 10px; }
            #${DRAWER_ID} .calc-draft-drawer-header { padding: 11px 12px; }
            #${DRAWER_ID} .calc-draft-toolbar { padding: 9px 10px; }
            #${DRAWER_ID} .calc-draft-toolbar .sba-gui-btn { min-height: 36px !important; padding: 7px 8px !important; }
            #${EDITOR_ID} { padding: 10px 10px 12px; }
            #${EDITOR_ID} .calc-draft-grid { grid-template-columns: 1fr; }
        }
    `;
    style.textContent += `
        dialog#${DRAWER_ID} {
            position: fixed; inset: 0; margin: auto; padding: 0;
            width: min(780px, calc(100vw - 24px)); height: min(780px, calc(100dvh - 40px));
            max-height: calc(100dvh - 40px); max-width: calc(100vw - 24px);
            background: #0b1320; border-color: var(--calc-draft-accent);
            box-shadow: 0 24px 80px #000a; border-radius: 12px;
        }
        dialog#${DRAWER_ID}::backdrop { background: #020610bd; backdrop-filter: blur(5px); }
        dialog#${DRAWER_ID} { --calc-draft-accent: #60a5fa; --calc-draft-ink: #f1f5ff; border: 2px solid #3b82f699; }
        dialog#${DRAWER_ID} .calc-draft-drawer-header { background: linear-gradient(135deg, #1e40af, #1d4ed8 50%, #2563eb); border-bottom: 1px solid #60a5fa99; padding: 16px 20px; }
        dialog#${DRAWER_ID} .calc-draft-drawer-title { font-size: 17px; }
        dialog#${DRAWER_ID} #${EDITOR_ID} { max-height: none; padding: 16px 20px; gap: 12px; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details > div > :not(.calc-draft-field) { grid-column: 1 / -1; }
        dialog#${DRAWER_ID} #${EDITOR_ID} .calc-draft-field:has(input[type="checkbox"]) { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
        dialog#${DRAWER_ID} #${EDITOR_ID} input[type="checkbox"] { appearance: auto; width: 16px; height: 16px; min-height: 0; padding: 0; flex: 0 0 16px; accent-color: var(--calc-draft-accent); }
        dialog#${DRAWER_ID} #${EDITOR_ID} .calc-draft-source { opacity: .7; font-size: 10px; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details { --section-color: #60a5fa; --section-dark: #1e40af; border: 1px solid color-mix(in srgb, var(--section-color) 60%, transparent); border-inline-width: 3px; background: rgba(8,14,28,.75); padding: 0 12px 12px; overflow: visible; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details > summary { margin: 0 -12px; padding: 12px; color: #fff; background: linear-gradient(135deg, var(--section-dark), color-mix(in srgb, var(--section-color) 80%, #102038)); border-radius: 7px 7px 0 0; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details[open] > summary { margin-bottom: 10px; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details:not([open]) { padding-bottom: 0; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details[data-draft-section="stats"] { --section-color: #34d399; --section-dark: #065f46; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details[data-draft-section="super"] { --section-color: #eab308; --section-dark: #854d0e; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details:is([data-draft-section="active"],[data-draft-section="links"]) { --section-color: #fb923c; --section-dark: #9a3412; }
        dialog#${DRAWER_ID} #${EDITOR_ID} > details:is([data-draft-section="advanced"],[data-draft-section="notes"]) { --section-color: #a78bfa; --section-dark: #5b21b6; }
        dialog#${DRAWER_ID} .calc-draft-toolbar { background: #08101e; gap: 10px; }
        dialog#${DRAWER_ID} .calc-draft-toolbar .sba-gui-btn {
            border: 1px solid #60a5fa66 !important; border-radius: 6px !important;
            background: #16243a !important; color: #e2edff !important; box-shadow: inset 0 1px 0 #ffffff0d !important;
            min-height: 34px !important; padding: 7px 14px !important; transition: background .15s ease, border-color .15s ease;
        }
        dialog#${DRAWER_ID} .calc-draft-toolbar .calc-draft-reset { flex: 0 1 auto; margin-right: auto; }
        dialog#${DRAWER_ID} .calc-draft-toolbar .calc-draft-apply { flex: 0 1 auto; background: linear-gradient(135deg,#1e40af,#2563eb) !important; border-color: #60a5fa !important; color: #fff !important; }
        dialog#${DRAWER_ID} .calc-draft-toolbar .sba-gui-btn:hover:not(:disabled) { background: #24446b !important; border-color: #93c5fd !important; }
        dialog#${DRAWER_ID} .calc-draft-close { background: #07152c66; border-color: #bfdbfe66; color: #fff; }
        @media (max-width: 600px) {
            dialog#${DRAWER_ID} #${EDITOR_ID} { padding: 12px; }
            dialog#${DRAWER_ID} #${EDITOR_ID} > details > div { grid-template-columns: minmax(0, 1fr); }
        }
    `;
    document.head.append(style);
}

function installShell() {
    const settingsDrawer = document.getElementById('settingsDrawer');
    const cardActions = settingsDrawer?.querySelector('.settings-theme-section');
    if (!settingsDrawer || !cardActions || document.getElementById(PANEL_ID)) return;
    const panel = createEl('section', 'settings-theme-section sba-settings-section calc-draft-panel');
    panel.id = PANEL_ID;
    const title = createEl('span', 'filter-group-title calc-draft-title', 'Calculator Draft');
    const label = createEl('label', 'calc-draft-toggle-row');
    const toggle = createEl('input');
    toggle.type = 'checkbox';
    toggle.id = 'calc-draft-toggle';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', 'Enable draft editing');
    toggle.setAttribute('aria-describedby', 'calc-draft-status');
    const toggleCopy = createEl('span', 'calc-draft-toggle-copy');
    const toggleText = createEl('span', 'calc-draft-toggle-label', 'Enable draft editing');
    const toggleState = createEl('span', 'calc-draft-toggle-state', 'Off');
    toggleCopy.append(toggleText, toggleState);
    label.append(toggle, toggleCopy);
    const status = createEl('p', 'calc-draft-status', 'Select a character to edit its calculation values.');
    status.id = 'calc-draft-status';
    const toolbar = createEl('div', 'calc-draft-toolbar');
    const reset = createEl('button', 'sba-gui-btn calc-draft-reset', 'Reset to source');
    reset.type = 'button';
    reset.dataset.draftAction = 'reset';
    const open = createEl('button', 'sba-gui-btn calc-draft-open', 'Edit values');
    open.type = 'button';
    open.dataset.draftAction = 'open';
    toolbar.append(open, reset);
    panel.append(title, label, status, toolbar);
    cardActions.after(panel);

    const view = document.getElementById('calculator-view');
    if (!view?.parentElement) return;
    const workspace = createEl('div');
    workspace.id = WORKSPACE_ID;
    view.parentElement.insertBefore(workspace, view);
    workspace.append(view);

    const sideDrawer = createEl('dialog', 'calc-draft-drawer');
    sideDrawer.id = DRAWER_ID;
    sideDrawer.setAttribute('aria-label', 'Draft calculation values');
    sideDrawer.hidden = true;
    sideDrawer.addEventListener('cancel', event => {
        event.preventDefault();
        closeDraftEditor();
    });
    const header = createEl('div', 'calc-draft-drawer-header');
    header.append(createEl('h2', 'calc-draft-drawer-title', 'Edit Calculation Values'));
    const close = createEl('button', 'calc-draft-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close draft editor');
    close.dataset.draftAction = 'close';
    header.append(close);
    const drawerToolbar = createEl('div', 'calc-draft-toolbar');
    const resetDrawer = createEl('button', 'sba-gui-btn calc-draft-reset', 'Reset to source');
    resetDrawer.type = 'button';
    resetDrawer.dataset.draftAction = 'reset';
    const apply = createEl('button', 'sba-gui-btn calc-draft-apply', 'Apply & Done');
    apply.type = 'button';
    apply.dataset.draftAction = 'apply';
    drawerToolbar.append(resetDrawer, apply);
    const editor = createEl('div');
    editor.id = EDITOR_ID;
    const error = createEl('p');
    error.id = ERROR_ID;
    error.setAttribute('role', 'alert');
    error.hidden = true;
    sideDrawer.append(header, drawerToolbar, error, editor);
    workspace.append(sideDrawer);

    const studio = document.getElementById('calc-studio-main-layout');
    if (studio?.parentElement) {
        const banner = createEl('div');
        banner.id = BANNER_ID;
        banner.setAttribute('role', 'status');
        banner.hidden = true;
        studio.parentElement.insertBefore(banner, studio);
    }
    toggle.addEventListener('change', () => {
        editingEnabled = toggle.checked;
        if (editingEnabled) {
            openDraftEditor();
        } else closeDraftEditor();
        updateShell(currentEntry());
    });
    panel.addEventListener('click', event => {
        const action = event.target?.closest?.('[data-draft-action]')?.dataset.draftAction;
        if (action === 'reset') resetCurrentDraft();
        if (action === 'open') {
            editingEnabled = true;
            openDraftEditor();
            updateShell(currentEntry());
        }
    });
    editor.addEventListener('input', event => {
        if (event.target?.type === 'checkbox' || event.target?.tagName === 'SELECT') return;
        handleDraftField(event);
    });
    editor.addEventListener('change', handleDraftField);
    editor.addEventListener('click', event => {
        const action = event.target?.closest?.('[data-draft-action]')?.dataset.draftAction;
        if (!action) return;
        if (action === 'reset') resetCurrentDraft();
        else addEditorRow(action);
    });
    sideDrawer.addEventListener('click', event => {
        const action = event.target?.closest?.('[data-draft-action]')?.dataset.draftAction;
        if (action === 'apply') commitCurrentDraft({ close: true });
        if (action === 'close') closeDraftEditor();
        if (action === 'reset') resetCurrentDraft();
    });
    document.addEventListener('click', event => {
        const action = event.target?.closest?.('[data-draft-remove]')?.dataset.draftRemove;
        if (action) addEditorRow(action);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && panelOpen) closeDraftEditor();
    });
}

function openDraftEditor() {
    const info = entryForCurrentCard({ create: true });
    if (!info?.entry) return;
    currentKey = info.key;
    panelOpen = true;
    buildEditor(info.entry);
    updateShell(info.entry);
    const settingsDrawer = document.getElementById('settingsDrawer');
    if (settingsDrawer?.classList.contains('open') || document.body.classList.contains('sba-side-settings-open')) {
        window.toggleSettingsDrawer?.();
    }
}

function closeDraftEditor() {
    panelOpen = false;
    updateShell(currentEntry());
}

function beforeCalculate() {
    const info = entryForCurrentCard();
    if (!info) return;
    const { key } = info;
    let { entry } = info;
    const newCardOrForm = key !== currentKey;
    const reloadedSource = !newCardOrForm && entry && window.lastParsedSaBlocksData && window.lastParsedSaBlocksData.__calculatorDraftKey !== key;
    if (newCardOrForm || reloadedSource) {
        currentKey = key;
        if (!entry && editingEnabled) {
            entry = createEntry(getCurrentMeta());
            entries.set(key, entry);
        }
        if (entry?.applied) {
            applyEntry(entry, entry.applied, { render: true, forceLinks: true });
        }
        if (editingEnabled && entry) buildEditor(entry);
        updateShell(entry);
        return;
    }
    if (!entry && editingEnabled) {
        entry = createEntry(getCurrentMeta());
        entries.set(key, entry);
        currentKey = key;
        buildEditor(entry);
        updateShell(entry);
        return;
    }
    if (entry) {
        if (entry.applied) {
            syncRuntime(entry, entry.applied);
            if (!entry.draft.dirty) entry.draft = clone(entry.applied);
            applyEntry(entry, entry.applied);
            if (editingEnabled && panelOpen && !entry.draft.dirty) buildEditor(entry);
        } else if (!entry.draft.dirty) {
            entry.draft = createDraftFromSource(captureSource(getCurrentMeta()), getCurrentMeta());
            if (editingEnabled && panelOpen) buildEditor(entry);
        }
        if (editingEnabled) updateShell(entry);
    }
}

function resetCurrentDraft() {
    const info = entryForCurrentCard();
    if (!info?.entry) return;
    const source = clone(info.entry.source);
    const originalDraft = createDraftFromSource(source, getCurrentMeta());
    const fresh = { source, draft: clone(originalDraft), applied: originalDraft };
    entries.set(info.key, fresh);
    currentKey = info.key;
    applyEntry(fresh, fresh.applied, { render: true, forceLinks: true });
    buildEditor(fresh);
    updateShell(fresh);
    window.calculateDokkanStats?.();
}

function currentEntry() {
    return currentKey ? entries.get(currentKey) || null : null;
}

function updateShell(entry) {
    const toggle = document.getElementById('calc-draft-toggle');
    const toggleRow = document.querySelector(`#${PANEL_ID} .calc-draft-toggle-row`);
    const toggleState = document.querySelector(`#${PANEL_ID} .calc-draft-toggle-state`);
    const status = document.getElementById('calc-draft-status');
    const editor = document.getElementById(EDITOR_ID);
    const resets = document.querySelectorAll(`#${PANEL_ID} [data-draft-action="reset"], #${DRAWER_ID} [data-draft-action="reset"]`);
    const open = document.querySelector(`#${PANEL_ID} [data-draft-action="open"]`);
    const drawer = document.getElementById(DRAWER_ID);
    const workspace = document.getElementById(WORKSPACE_ID);
    const loaded = !!getCurrentMeta();
    if (toggle) {
        toggle.disabled = !loaded;
        toggle.checked = editingEnabled;
        toggle.setAttribute('aria-checked', String(editingEnabled));
    }
    if (toggleRow) toggleRow.classList.toggle('is-enabled', editingEnabled);
    if (toggleState) toggleState.textContent = editingEnabled ? 'On' : 'Off';
    if (status) status.textContent = !loaded
        ? 'Select a character to edit its calculation values.'
        : entry ? (entry.draft.dirty ? 'Pending edits. Apply & Done to update calculator results.' : entry.applied ? (editingEnabled ? 'Applied. New edits stay pending until you apply them.' : 'Applied. Enable draft editing in Settings to make changes.') : 'Ready. Edits wait for Apply & Done.')
            : 'Enable draft editing to create values for this character.';
    resets.forEach(reset => { reset.disabled = !entry; });
    if (open) open.disabled = !loaded;
    if (editor) editor.hidden = !entry;
    if (drawer) {
        const visible = !!(panelOpen && editingEnabled && entry);
        drawer.hidden = !visible;
        if (visible && !drawer.open) drawer.showModal();
        else if (!visible && drawer.open) drawer.close();
    }
    if (workspace) workspace.classList.remove('calc-draft-open');
    const banner = document.getElementById(BANNER_ID);
    if (banner) {
        banner.hidden = !entry?.applied;
        banner.textContent = entry?.applied
            ? (entry.draft.dirty ? 'Applied values are in use. New edits are pending and have not changed these results.' : 'Applied for this character and form in this calculator tab.')
            : '';
    }
}

function createEl(tag, className = '', text = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== '') el.textContent = text;
    return el;
}

function createSection(title, description, open = false) {
    const root = createEl('details');
    root.open = open;
    const summary = createEl('summary', '', title);
    const body = createEl('div');
    if (description) body.append(createEl('p', 'calc-draft-help', description));
    root.append(summary, body);
    return { root, body };
}

function field(labelText, control, source = '—') {
    const wrap = createEl('div', 'calc-draft-field');
    const label = createEl('label', '', labelText);
    if (!control.id) control.id = `calc-draft-field-${++fieldSequence}`;
    if (control.id) label.htmlFor = control.id;
    wrap.append(label, control, createEl('span', 'calc-draft-source', `Source: ${String(source ?? '—')}`));
    return wrap;
}

function createInput(type, value, options = {}) {
    const input = createEl(type === 'textarea' ? 'textarea' : 'input');
    if (type !== 'textarea') input.type = type;
    if (type === 'number') {
        input.step = options.step || 'any';
        input.inputMode = 'decimal';
    }
    input.value = value ?? '';
    if (options.min != null) input.min = String(options.min);
    if (options.max != null) input.max = String(options.max);
    return input;
}

function createSelect(options, selected) {
    const select = createEl('select');
    options.forEach(option => {
        const [value, label] = Array.isArray(option) ? option : [option, option];
        const item = createEl('option', '', label);
        item.value = value;
        item.selected = String(selected) === String(value);
        select.append(item);
    });
    return select;
}

function fieldForControl(id, labelText, type, entry) {
    const source = controlValue(entry.source.controls, id);
    const current = controlValue(entry.draft.controls, id);
    const sourceElement = document.getElementById(id);
    const control = type === 'checkbox' ? createEl('input') : type === 'select'
        ? createSelect(Array.from(sourceElement?.options || []).map(option => [option.value, option.textContent]), current)
        : createInput(type, current);
    control.id = `calc-draft-${id}`;
    if (type === 'checkbox') {
        control.type = 'checkbox';
        control.checked = !!current;
        control.dataset.draftScope = 'control';
        control.dataset.controlId = id;
    } else {
        control.dataset.draftScope = 'control';
        control.dataset.controlId = id;
    }
    return field(labelText, control, source);
}

function actionButton(label, action) {
    const button = createEl('button', 'calc-draft-add', label);
    button.type = 'button';
    button.dataset.draftAction = action;
    return button;
}

function removeButton(label, action) {
    const button = createEl('button', 'calc-draft-remove', label);
    button.type = 'button';
    button.dataset.draftRemove = action;
    return button;
}

function editorCard(title) {
    const card = createEl('section', 'calc-draft-card');
    card.append(createEl('h4', 'calc-draft-card-title', title));
    return card;
}

function tagField(control, scope, index, fieldName) {
    control.dataset.draftScope = scope;
    control.dataset.draftIndex = String(index);
    control.dataset.draftField = fieldName;
    return control;
}

function checkboxField(labelText, checked, scope, index, fieldName, disabled = false) {
    const label = createEl('label', 'calc-draft-check');
    const input = createEl('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.disabled = disabled;
    if (scope) tagField(input, scope, index, fieldName);
    label.append(input, createEl('span', '', labelText));
    return label;
}

function linkEditorRow(link, index, entry) {
    const card = editorCard(`Link ${index + 1}: ${plainText(link.name) || 'Unnamed link'}`);
    const grid = createEl('div', 'calc-draft-grid');
    const specs = [['name', 'Name', 'text'], ['atk', 'ATK %', 'number'], ['def', 'DEF %', 'number'], ['ki', 'Ki', 'number']];
    specs.forEach(([key, labelText, type]) => {
        const control = tagField(createInput(type, link[key] ?? (type === 'number' ? 0 : '')), 'link', index, key);
        grid.append(field(labelText, control, entry.source.links[index]?.[key] ?? '—'));
    });
    card.append(grid, checkboxField('Active', link.active, 'link', index, 'active'));
    card.append(removeButton('Remove link', `remove-link:${index}`));
    return card;
}

function passiveEditorRow(line, index, entry) {
    const card = editorCard(`Effect ${index + 1}: ${plainText(line.draftText).slice(0, 46) || 'Draft effect'}`);
    const text = tagField(createInput('textarea', line.draftText), 'passive', index, 'draftText');
    const condition = tagField(createInput('textarea', line.draftCondition), 'passive', index, 'draftCondition');
    card.append(field('Effect text', text, entry.source.passiveLines[index]?.text || 'Added in draft'));
    card.append(createEl('p', 'calc-draft-help calc-draft-parse-status', 'Simple ATK/DEF percentages update as you type. Review complex effects in Advanced values, then Apply to calculate.'));
    card.append(field('Condition / when it applies', condition, entry.source.passiveLines[index]?.isConditional ? 'Parsed as conditional' : 'No condition parsed'));
    const grid = createEl('div', 'calc-draft-grid');
    const target = tagField(createSelect([['self', 'Self'], ['allies-including-self', 'Allies, including self'], ['allies-excluded', 'Other allies (self excluded)'], ['enemy', 'Enemy target']], line.draftTarget), 'passive', index, 'draftTarget');
    const timing = tagField(createSelect([['start', 'Start of turn'], ['attack', 'Attacking phase'], ['within', 'Each later attack this turn']], line.draftTiming), 'passive', index, 'draftTiming');
    grid.append(field('Target', target, line.draftTarget), field('Timing', timing, line.draftTiming));
    [['draftAtk', 'ATK %'], ['draftDef', 'DEF %'], ['draftStackCount', 'Stack count'], ['draftMaxPctCap', 'Percent cap']].forEach(([key, labelText]) => {
        grid.append(field(labelText, tagField(createInput('number', line[key]), 'passive', index, key), entry.source.passiveLines[index]?.[key.replace('draft', '').toLowerCase()] ?? line[key]));
    });
    grid.append(field('Damage reduction %', tagField(createInput('number', line.draftDr), 'passive', index, 'draftDr'), entry.source.passiveLines[index]?.drVal ?? 0));
    grid.append(field('Additional Super Attack type', tagField(createSelect([['none', 'None'], ['sa', '12 Ki Super Attack'], ['ultra', 'Ultra Super Attack']], line.draftAdditionalKind), 'passive', index, 'draftAdditionalKind'), entry.source.passiveLines[index]?.isAdditionalUltraSa ? 'Parsed Ultra SA' : entry.source.passiveLines[index]?.isAdditionalSa ? 'Parsed SA' : 'None parsed'));
    grid.append(field('Additional attacks available (max)', tagField(createInput('number', line.draftAdditionalSaMax), 'passive', index, 'draftAdditionalSaMax'), entry.source.passiveLines[index]?.addSaMax ?? 0));
    grid.append(field('Additional attacks selected', tagField(createInput('number', line.draftAdditionalSaCount), 'passive', index, 'draftAdditionalSaCount'), entry.source.passiveLines[index]?.addSaCount ?? 0));
    grid.append(field('Counter type', tagField(createSelect([['none', 'None'], ['sa', 'Super Attack counter'], ['normal', 'Normal attack counter']], line.draftCounterKind), 'passive', index, 'draftCounterKind'), entry.source.passiveLines[index]?.isSaCounter ? 'Parsed SA counter' : entry.source.passiveLines[index]?.isNormalCounter ? 'Parsed normal counter' : 'None parsed'));
    grid.append(field('Counter multiplier %', tagField(createInput('number', line.draftCounterPower), 'passive', index, 'draftCounterPower'), entry.source.passiveLines[index]?.counterPower ?? 300));
    grid.append(field('Counter ATK bonus %', tagField(createInput('number', line.draftCounterTempAtk), 'passive', index, 'draftCounterTempAtk'), entry.source.passiveLines[index]?.counterTempAtk ?? 0));
    grid.append(field('Counter trigger', tagField(createInput('text', line.draftCounterTrigger), 'passive', index, 'draftCounterTrigger'), entry.source.passiveLines[index]?.counterTriggerCat ?? 'Super Attack'));
    grid.append(field('Counter timing', tagField(createSelect([['after', 'After being hit'], ['before', 'Before being hit']], line.draftCounterTiming), 'passive', index, 'draftCounterTiming'), entry.source.passiveLines[index]?.counterTiming ?? 'after'));
    grid.append(field('Normal counters selected', tagField(createInput('number', line.draftCounterCount), 'passive', index, 'draftCounterCount'), entry.source.passiveLines[index]?.counterCount ?? 0));
    grid.append(checkboxField('Guard against all attacks', line.draftGuard, 'passive', index, 'draftGuard'));
    const advanced = createSection('Advanced values and targeting', 'Manual overrides for complex effects. Editing supported effect text replaces its ATK/DEF values.', false);
    advanced.body.append(grid, checkboxField('Multiply by stack count', line.draftStacking, 'passive', index, 'draftStacking'));
    card.append(advanced.root, checkboxField('Active / condition met', line.draftActive, 'passive', index, 'draftActive'));
    card.append(removeButton('Remove effect', `remove-passive:${index}`));
    return card;
}

function saEditorRow(sa, index, entry) {
    const card = editorCard(`${sa.draftTypeLabel || 'Super Attack'} ${index + 1}: ${sa.draftNameText || 'Unnamed'}`);
    const text = tagField(createInput('text', sa.draftNameText), 'sa', index, 'draftNameText');
    const typeLabel = tagField(createInput('text', sa.draftTypeLabel), 'sa', index, 'draftTypeLabel');
    const condition = tagField(createInput('textarea', sa.draftConditionText), 'sa', index, 'draftConditionText');
    const effectText = tagField(createInput('textarea', sa.draftFullText), 'sa', index, 'draftFullText');
    card.append(field('Attack name', text, entry.source.saBlocks[index]?.saName || 'Added in draft'));
    card.append(field('Attack label', typeLabel, entry.source.saBlocks[index]?.typeLabel || 'Added in draft'));
    card.append(field('Condition text', condition, entry.source.saBlocks[index]?.condition || entry.source.saBlocks[index]?.activationText || 'No condition parsed'));
    card.append(field('Effect text', effectText, entry.source.saBlocks[index]?.fullText || 'Added in draft'));
    if (sa.draftConditionRequired) card.append(checkboxField('Condition met this turn', sa.draftConditionMet, 'sa', index, 'draftConditionMet'));
    else card.append(createEl('p', 'calc-draft-help', 'No teammate condition was parsed; this Super Attack is available when its Ki requirement is met.'));
    const grid = createEl('div', 'calc-draft-grid');
    const numberFields = [
        ['draftStartKi', 'Starting Ki'], ['draftEndKi', 'Ending Ki (0 = no cap)'], ['draftMultiplier', 'Super Attack multiplier'],
        ['draftAtk', 'Current self ATK %'], ['draftDef', 'Current self DEF %'], ['draftTurnAtk', 'Further ATK this turn %'],
        ['draftTurnDef', 'Further DEF this turn %'], ['draftAllyAtk', 'Other allies ATK %'], ['draftAllyDef', 'Other allies DEF %']
    ];
    numberFields.forEach(([key, labelText]) => {
        const sourceSa = entry.source.saBlocks[index] || {};
        const sourceValues = {
            draftStartKi: sourceSa.startKi ?? sourceSa.eball_num_start,
            draftEndKi: sourceSa.endKi ?? sourceSa.eball_num_end,
            draftMultiplier: sourceSa.exact_multiplier,
            draftAtk: sourceSa.eff?.atk,
            draftDef: sourceSa.eff?.def
        };
        const source = key === 'draftTurnAtk' || key === 'draftTurnDef' ? 'Parsed “further … for 1 turn” text or 0' :
            key === 'draftAllyAtk' || key === 'draftAllyDef' ? 'Parsed ally support or 0' : sourceValues[key] ?? '—';
        grid.append(field(labelText, tagField(createInput('number', sa[key]), 'sa', index, key), source));
    });
    const target = tagField(createSelect([['self', 'Self'], ['allies-including-self', 'All allies'], ['allies-excluded', 'Other allies (self excluded)'], ['enemy', 'Enemy target']], sa.draftTarget), 'sa', index, 'draftTarget');
    const timing = tagField(createSelect([['source', 'Preserve calculator behavior'], ['current', 'Current hit only'], ['current-turn', 'Current hit + later attacks this turn']], sa.draftAtkTiming), 'sa', index, 'draftAtkTiming');
    grid.append(field('Current-effect target', target, sa.draftTarget), field('Current-effect duration', timing, sa.draftAtkTiming));
    card.append(grid,
        checkboxField('EX attack block', sa.draftIsEx, 'sa', index, 'draftIsEx'),
        checkboxField('Unit Super Attack block', sa.draftIsUnit, 'sa', index, 'draftIsUnit'),
        createEl('p', 'calc-draft-help', `Other allies’ +${numeric(sa.draftAllyAtk)}% ATK / +${numeric(sa.draftAllyDef)}% DEF is recorded for reference and never added to this character’s own stats.`),
        removeButton('Remove Super Attack', `remove-sa:${index}`));
    return card;
}

function stageEditorRow(row, index, entry) {
    const card = editorCard(`${row.name || 'Numeric override'} · ${row.stage}`);
    const grid = createEl('div', 'calc-draft-grid');
    const specs = [
        ['name', 'Effect name', 'text', null], ['condition', 'Condition', 'text', null],
        ['stage', 'Calculation stage', 'select', [['start', 'Start of turn'], ['attack', 'Attacking phase'], ['within', 'Later attacks this turn'], ['domain', 'Domain bracket'], ['links', 'Link bracket'], ['active', 'Active skill bracket'], ['sa-current', 'Selected Super Attack'], ['sa-turn', 'Selected SA, later attacks']]],
        ['stat', 'Stat', 'select', [['atk', 'ATK'], ['def', 'DEF'], ['both', 'ATK & DEF']]],
        ['value', 'Percent', 'number', null], ['target', 'Target', 'select', [['self', 'Self'], ['allies-including-self', 'Allies, including self'], ['allies-excluded', 'Other allies (self excluded)'], ['enemy', 'Enemy target']]]
    ];
    specs.forEach(([key, labelText, type, options]) => {
        const control = type === 'select' ? createSelect(options, row[key]) : createInput(type, row[key]);
        grid.append(field(labelText, tagField(control, 'stage', index, key), key === 'value' ? 'No source value' : 'Draft only'));
    });
    const indexControl = tagField(createSelect(entry.draft.saBlocks.map((sa, saIndex) => [String(saIndex), `${saIndex + 1}. ${sa.draftNameText}`]), row.saIndex), 'stage', index, 'saIndex');
    grid.append(field('Super Attack (for SA stages)', indexControl, 'Draft choice'));
    card.append(grid, checkboxField('Active', row.active, 'stage', index, 'active'), removeButton('Remove override', `remove-stage:${index}`));
    return card;
}

const entries = new Map();
let editingEnabled = false;
let panelOpen = false;
let currentKey = '';
let fieldSequence = 0;

function injectSupportStyles() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeDraftMode, { once: true });
    else initializeDraftMode();
}

function initializeDraftMode() {
    installStyles();
    installShell();
    window.CalculatorDraftMode = {
        beforeCalculate,
        inferFurtherOneTurnRaises,
        inferAllySupport,
        makeCalculatorDraftKey,
        getDraft: () => currentEntry()?.applied || null,
        afterCalculate() {
            const draft = currentEntry()?.applied;
            if (!draft) return;
            const name = document.getElementById('calc-char-name-text');
            if (name) name.textContent = draft.profile.name;
            const statsName = document.getElementById('sc-name');
            if (statsName) statsName.textContent = draft.profile.name;
        },
        getSelectedSaIndex(saBlocks, currentKi) {
            const draft = currentEntry()?.applied;
            if (!draft) return null;
            const explicit = draft.selectedSaIndex;
            if (Number.isInteger(explicit) && explicit >= 0 && explicit < saBlocks.length) return explicit;
            return null;
        }
    };
    updateShell(currentEntry());
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') injectSupportStyles();
