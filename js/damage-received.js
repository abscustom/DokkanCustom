import { calculateDamageReceived, typeRelation } from './damage-received-engine.js?v=20261010-damage-received-engine-v4';

const formatInteger = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const formatDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const formatFiniteInteger = (value) => Number.isFinite(value) ? formatInteger.format(value) : '—';
const byId = (id) => document.getElementById(id);

const refs = {
    page: byId('damage-received-page'),
    validation: byId('dr-validation-message'),
    normalResult: byId('dr-normal-result'),
    superResult: byId('dr-super-result'),
    normalDamageNote: byId('dr-normal-damage-note'),
    superDamageNote: byId('dr-super-damage-note'),
    normalHp: byId('dr-normal-hp-remaining'),
    superHp: byId('dr-super-hp-remaining'),
    normalHpPercent: byId('dr-normal-hp-percent'),
    superHpPercent: byId('dr-super-hp-percent'),
    normalHpTrack: byId('dr-normal-hp-track'),
    superHpTrack: byId('dr-super-hp-track'),
    normalOverkill: byId('dr-normal-overkill'),
    superOverkill: byId('dr-super-overkill'),
    resultSummary: byId('dr-result-summary'),
    breakdown: byId('dr-breakdown'),
    eligibility: byId('dr-domain-eligibility')
};

function numberValue(id, fallback = 0) {
    const input = byId(id);
    const value = Number(input?.value);
    return Number.isFinite(value) ? value : fallback;
}

function selectedValue(id, fallback = '') {
    return byId(id)?.value || fallback;
}

function characterCategories() {
    const raw = byId('dr-character-categories').value.trim();
    return raw ? raw.split(',').map((category) => category.trim()).filter(Boolean) : null;
}

function readInput() {
    return {
        phase1Defense: numberValue('dr-phase1-defense'),
        phase2DefensePct: numberValue('dr-phase2-defense'),
        phase2Active: byId('dr-phase2-active').checked,
        superAttackDefensePct: numberValue('dr-sa-defense'),
        superAttackDefenseActive: byId('dr-sa-defense-active').checked,
        normalAttackCount: numberValue('dr-normal-attack-count', 1),
        character: {
            currentHp: numberValue('dr-current-hp'),
            class: selectedValue('dr-character-class', 'super'),
            type: selectedValue('dr-character-type', 'TEQ'),
            guard: byId('dr-guard').checked,
            damageReductionPct: numberValue('dr-damage-reduction'),
            normalDamageReductionPct: numberValue('dr-normal-reduction'),
            typeDefenseBoostLevel: numberValue('dr-type-defense-boost'),
            categories: characterCategories()
        },
        enemy: {
            class: selectedValue('dr-enemy-class', 'super'),
            type: selectedValue('dr-enemy-type', 'TEQ'),
            attackStat: numberValue('dr-enemy-attack'),
            attackStatIncreasePct: numberValue('dr-enemy-atk-increase'),
            itemAttackDownPct: numberValue('dr-item-atk-down'),
            passiveAttackDownPct: numberValue('dr-passive-atk-down'),
            superAttackMultiplierPct: numberValue('dr-sa-multiplier', 300),
            superAttackDownPct: numberValue('dr-sa-atk-down'),
            damageIncreasePct: numberValue('dr-enemy-damage-increase'),
            defenseReductionPct: numberValue('dr-defense-reduction'),
            variance: numberValue('dr-variance', 1.015),
            critical: byId('dr-critical').checked
        },
        domain: {
            active: byId('dr-domain-active').checked,
            damageReceivedIncreasePct: numberValue('dr-domain-damage-increase'),
            targetClass: selectedValue('dr-domain-target-class', 'any'),
            targetType: selectedValue('dr-domain-target-type', 'any'),
            requiredCategories: byId('dr-domain-required-categories').value
        }
    };
}

function formatDomainStatus(result) {
    if (!byId('dr-domain-active').checked) return 'Domain inactive. No Domain amplification applied.';
    if (result.eligible === true) return `Eligible — ${result.reason}`;
    if (result.eligible === false) return `Not eligible — ${result.reason}`;
    return `Eligibility unknown — ${result.reason}`;
}

function formatRelation(relation, guard) {
    if (guard) return relation === 'character-advantage' ? 'Guard + type advantage' : 'Guard active';
    if (relation === 'character-advantage') return 'Character type advantage';
    if (relation === 'enemy-advantage') return 'Enemy type advantage';
    return 'Same or neutral type';
}

function addBreakdownRow(list, label, value) {
    const row = document.createElement('div');
    row.className = 'dr-breakdown-row';
    const term = document.createElement('dt');
    term.textContent = label;
    const amount = document.createElement('dd');
    amount.textContent = value;
    row.append(term, amount);
    list.appendChild(row);
}

function renderBreakdown(result, kind) {
    const breakdown = result.breakdown;
    const column = document.createElement('div');
    column.className = 'dr-breakdown-column';
    const heading = document.createElement('h3');
    heading.textContent = kind === 'normal' ? 'Normal attack' : 'Super Attack';
    const list = document.createElement('dl');
    list.className = 'dr-breakdown-list';
    const def = breakdown.defense;
    addBreakdownRow(list, 'Pre-turn in-game DEF', formatFiniteInteger(def.phase1Defense));
    addBreakdownRow(list, 'After Phase 2', formatFiniteInteger(def.afterPhase2));
    addBreakdownRow(list, 'DEF before enemy reduction', formatFiniteInteger(def.beforeEnemyReduction));
    addBreakdownRow(list, 'Enemy ATK after stat increase', formatFiniteInteger(breakdown.afterAttackStatIncrease));
    addBreakdownRow(list, 'After item/passive ATK Down', formatFiniteInteger(breakdown.afterItemAndPassiveAttackDown));
    addBreakdownRow(list, `${kind === 'normal' ? 'Normal' : 'Super'} attack multiplier`, `${formatDecimal.format(breakdown.attackMultiplierPct)}%`);
    addBreakdownRow(list, 'Incoming damage before character defenses', formatFiniteInteger(breakdown.incomingDamageBeforeCharacterDefense));
    addBreakdownRow(list, 'Scenario hit count', String(result.scenarioHitCount));
    addBreakdownRow(list, 'Damage received per hit', formatFiniteInteger(result.damage));
    addBreakdownRow(list, 'Total scenario damage', formatFiniteInteger(result.scenarioDamage));
    addBreakdownRow(list, 'HP before scenario', formatFiniteInteger(result.hp.starting));
    addBreakdownRow(list, 'HP remaining', result.hp.remaining === null ? 'Unavailable' : formatFiniteInteger(result.hp.remaining));
    addBreakdownRow(list, 'HP remaining percentage', result.hp.remainingPct === null ? 'Unavailable' : `${formatDecimal.format(result.hp.remainingPct)}%`);
    if (result.hp.overkill > 0) addBreakdownRow(list, 'Overkill past 0 HP', formatFiniteInteger(result.hp.overkill));
    addBreakdownRow(list, 'Damage reduction stage', `−${formatDecimal.format(breakdown.damageReductionPct)}%`);
    addBreakdownRow(list, 'Class matchup', breakdown.classMismatch ? `Different classes · ×${formatDecimal.format(breakdown.classMultiplier)}` : 'Same class');
    addBreakdownRow(list, 'After type/guard stage', formatFiniteInteger(breakdown.afterClassAndType));
    addBreakdownRow(list, 'DEF used after enemy DEF reduction', formatFiniteInteger(breakdown.effectiveDefense * breakdown.defenseFactor));
    addBreakdownRow(list, 'Damage before Domain', formatFiniteInteger(breakdown.beforeDamageReceivedIncrease));
    addBreakdownRow(list, 'Applied Domain damage increase', `+${formatDecimal.format(breakdown.domainDamageReceivedIncreasePct)}%`);
    column.append(heading, list);
    return column;
}

function hpRemainingBand(percentage) {
    if (!Number.isFinite(percentage)) return 'neutral';
    if (percentage > 50) return 'green';
    if (percentage >= 30) return 'yellow';
    return 'red';
}

function clearHpOutcome(kind) {
    refs[`${kind}HpTrack`].closest('.dr-result-card').dataset.hpBand = 'neutral';
    refs[`${kind}Hp`].value = '—';
    refs[`${kind}HpPercent`].value = '—';
    refs[`${kind}HpTrack`].querySelector('.dr-hp-fill').style.width = '0%';
    refs[`${kind}HpTrack`].setAttribute('aria-valuenow', '0');
    refs[`${kind}HpTrack`].setAttribute('aria-valuetext', 'Unavailable until the inputs are valid.');
    refs[`${kind}Overkill`].hidden = true;
    refs[`${kind}Overkill`].querySelector('output').value = '—';
}

function renderHpOutcome(kind, outcome) {
    const remainingHp = outcome.hp.remaining;
    const percentage = outcome.hp.remainingPct;
    const track = refs[`${kind}HpTrack`];
    const overkill = refs[`${kind}Overkill`];
    const fill = track.querySelector('.dr-hp-fill');
    const hasPercentage = Number.isFinite(percentage);
    const capped = hasPercentage ? Math.max(0, Math.min(percentage, 100)) : 0;

    track.closest('.dr-result-card').dataset.hpBand = hpRemainingBand(percentage);
    refs[`${kind}Hp`].value = Number.isFinite(remainingHp) ? formatFiniteInteger(remainingHp) : '—';
    refs[`${kind}HpPercent`].value = hasPercentage ? formatDecimal.format(percentage) : '—';
    fill.style.width = `${capped}%`;
    track.setAttribute('aria-valuenow', String(capped));
    track.setAttribute('aria-valuetext', hasPercentage
        ? `${formatDecimal.format(percentage)}% HP remaining; ${formatFiniteInteger(remainingHp)} of ${formatFiniteInteger(outcome.hp.starting)} HP.`
        : !(Number.isFinite(outcome.hp.starting) && outcome.hp.starting > 0)
            ? 'HP outcome unavailable because starting HP must be a positive finite number.'
            : 'HP outcome unavailable because scenario damage is not finite.');
    overkill.hidden = !(Number.isFinite(outcome.hp.overkill) && outcome.hp.overkill > 0);
    overkill.querySelector('output').value = overkill.hidden ? '—' : formatFiniteInteger(outcome.hp.overkill);
}

function showValidation() {
    const invalid = [];
    document.querySelectorAll('.dr-workspace input[type="number"]').forEach((input) => {
        const error = byId(`${input.id}-error`);
        const valid = input.disabled || (input.value.trim() !== '' && input.checkValidity());
        input.removeAttribute('aria-invalid');
        if (error) { error.hidden = true; error.textContent = ''; }
        if (valid) return;
        invalid.push(input);
        input.setAttribute('aria-invalid', 'true');
        const limits = input.max ? `${input.min}–${input.max}` : `${input.min} or more`;
        if (error) {
            error.textContent = `Enter ${limits}, in steps of ${input.step || '1'}.`;
            error.hidden = false;
        }
        // Reveal invalid advanced inputs so users can reach and correct them.
        const details = input.closest('details');
        if (details) details.open = true;
    });
    if (!invalid.length) {
        refs.validation.hidden = true;
        refs.validation.textContent = '';
        return true;
    }
    refs.validation.hidden = false;
    const names = invalid.map(input => input.closest('label').querySelector('span').textContent);
    refs.validation.textContent = `Check ${names.join(', ')}. Use the limits shown beneath each highlighted field.`;
    return false;
}

function render() {
    if (!showValidation()) {
        refs.normalResult.value = '—';
        refs.superResult.value = '—';
        refs.normalDamageNote.textContent = 'Correct the highlighted values to calculate this scenario.';
        refs.superDamageNote.textContent = 'Correct the highlighted values to calculate this scenario.';
        clearHpOutcome('normal');
        clearHpOutcome('super');
        byId('dr-total-sa').value = '—';
        refs.resultSummary.textContent = 'Results will return when the highlighted values are corrected.';
        refs.breakdown.replaceChildren();
        refs.eligibility.textContent = 'Correct the highlighted values to evaluate Domain eligibility.';
        return;
    }

    const input = readInput();
    const result = calculateDamageReceived(input);
    refs.normalResult.value = formatFiniteInteger(result.normal.scenarioDamage);
    refs.superResult.value = formatFiniteInteger(result.super.scenarioDamage);
    refs.normalDamageNote.textContent = `${result.normal.scenarioHitCount} Normal ${result.normal.scenarioHitCount === 1 ? 'attack' : 'attacks'} · ${formatFiniteInteger(result.normal.damage)} damage per hit.`;
    refs.superDamageNote.textContent = `One Super Attack · ${formatFiniteInteger(result.super.damage)} damage.`;
    renderHpOutcome('normal', result.normal);
    renderHpOutcome('super', result.super);
    byId('dr-total-sa').value = formatFiniteInteger(result.super.breakdown.afterAttackMultiplier);
    document.querySelectorAll('.dr-advanced').forEach((details) => {
        const badge = details.querySelector('.dr-active-count');
        if (details.id === 'dr-domain-options') {
            badge.textContent = input.domain.active ? (result.domainEligibility.eligible === true ? 'Active · applies' : 'Active · does not apply') : 'Inactive';
            return;
        }
        const count = Array.from(details.querySelectorAll('input[type="number"]')).filter(field => !field.disabled && Number(field.value) !== 0).length;
        badge.textContent = count ? `${count} configured` : '';
    });
    refs.eligibility.textContent = formatDomainStatus(result.domainEligibility);
    const relation = typeRelation(input.character.type, input.enemy.type);
    const classSummary = input.character.class !== input.enemy.class ? ' · class mismatch' : '';
    refs.resultSummary.textContent = `${formatRelation(relation, input.character.guard)}${classSummary} · ${formatDecimal.format(input.character.damageReductionPct)}% general DR${input.character.normalDamageReductionPct ? ` · ${formatDecimal.format(input.character.normalDamageReductionPct)}% normal DR` : ''}`;
    refs.breakdown.replaceChildren();
    refs.breakdown.append(
        renderBreakdown(result.normal, 'normal'),
        renderBreakdown(result.super, 'super')
    );
}

function wireInputs() {
    document.querySelectorAll('.dr-field').forEach((field) => {
        const input = field.querySelector('input, select');
        if (!input) return;
        const describedBy = [];
        field.querySelectorAll('small').forEach((help, index) => {
            help.id = `${input.id}-help-${index}`;
            describedBy.push(help.id);
        });
        if (input.type === 'number') {
            const error = document.createElement('small');
            error.id = `${input.id}-error`;
            error.className = 'dr-field-error';
            error.hidden = true;
            field.appendChild(error);
            describedBy.push(error.id);
        }
        if (describedBy.length) input.setAttribute('aria-describedby', describedBy.join(' '));
    });
    refs.page.addEventListener('input', render);
    refs.page.addEventListener('change', render);
}

wireInputs();
render();
