const TYPE_BEATS = Object.freeze({
    AGL: 'STR',
    STR: 'PHY',
    PHY: 'INT',
    INT: 'TEQ',
    TEQ: 'AGL'
});

const finite = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function typeRelation(characterType, enemyType) {
    const character = String(characterType || '').toUpperCase();
    const enemy = String(enemyType || '').toUpperCase();
    if (!TYPE_BEATS[character] || !TYPE_BEATS[enemy]) return 'neutral';
    if (TYPE_BEATS[character] === enemy) return 'character-advantage';
    if (TYPE_BEATS[enemy] === character) return 'enemy-advantage';
    return 'neutral';
}

function resolveDomainEligibility(input) {
    const domain = input.domain || {};
    const target = input.character || {};
    if (!domain.active) return { eligible: false, reason: 'Domain is inactive.' };

    const targetType = String(target.type || '').toUpperCase();
    const targetClass = String(target.class || '').toLowerCase();
    const requiredType = String(domain.targetType || 'any').toUpperCase();
    const requiredClass = String(domain.targetClass || 'any').toLowerCase();
    if (requiredType !== 'ANY' && requiredType !== targetType) {
        return { eligible: false, reason: `Domain targets ${requiredType}; this character is ${targetType || 'unknown'}.` };
    }
    if (requiredClass !== 'any' && requiredClass !== targetClass) {
        return { eligible: false, reason: `Domain targets ${requiredClass}; this character is ${targetClass || 'unknown'}.` };
    }

    const requiredCategories = Array.isArray(domain.requiredCategories)
        ? domain.requiredCategories.map(value => String(value).trim().toLocaleLowerCase()).filter(Boolean)
        : String(domain.requiredCategories || '').split(',').map(value => value.trim().toLocaleLowerCase()).filter(Boolean);
    if (!requiredCategories.length) return { eligible: true, reason: 'Target rule matches.' };

    const categories = target.categories;
    if (!Array.isArray(categories)) return { eligible: null, reason: 'Character categories are unknown, so Domain damage amplification is held at 0%.' };
    const normalizedCategories = new Set(categories.map(value => String(value).trim().toLocaleLowerCase()).filter(Boolean));
    const matched = requiredCategories.find(category => normalizedCategories.has(category));
    if (!matched) return { eligible: false, reason: `This character does not match any required category: ${requiredCategories.join(', ')}.` };
    return { eligible: true, reason: `Matched Domain category: ${matched}.` };
}

function defenseValueForHit(input) {
    const phase1Defense = Math.max(0, finite(input.phase1Defense, 0));
    const phase2Pct = input.phase2Active ? clamp(finite(input.phase2DefensePct), -100, 5000) : 0;
    const afterPhase2 = phase1Defense * (1 + phase2Pct / 100);
    const superAttackPct = input.superAttackDefenseActive
        ? clamp(finite(input.superAttackDefensePct), -100, 5000)
        : 0;
    return {
        phase1Defense,
        afterPhase2,
        beforeEnemyReduction: Math.max(0, afterPhase2 * (1 + superAttackPct / 100))
    };
}

function calculateOne(input, attackKind, domainEligibility) {
    const enemy = input.enemy || {};
    const character = input.character || {};
    const attackStat = Math.max(0, finite(enemy.attackStat));
    const atkIncreasePct = clamp(finite(enemy.attackStatIncreasePct), -100, 10000);
    const afterAttackStat = attackStat * (1 + atkIncreasePct / 100);

    const itemDown = clamp(finite(enemy.itemAttackDownPct), 0, 100);
    const passiveDown = clamp(finite(enemy.passiveAttackDownPct), 0, 100);
    const afterEnemyAttackDown = afterAttackStat * (1 - itemDown / 100) * (1 - passiveDown / 100);

    const configuredMultiplier = attackKind === 'normal' ? 100 : clamp(finite(enemy.superAttackMultiplierPct, 300), 0, 10000);
    const saDown = attackKind === 'super' ? clamp(finite(enemy.superAttackDownPct), 0, configuredMultiplier) : 0;
    const effectiveAttackMultiplierPct = Math.max(0, configuredMultiplier - saDown);
    const afterAttackMultiplier = afterEnemyAttackDown * effectiveAttackMultiplierPct / 100;

    const criticalMultiplier = enemy.critical ? 1.5 : 1;
    const afterCritical = afterAttackMultiplier * criticalMultiplier;
    const enemyDamageIncreasePct = clamp(finite(enemy.damageIncreasePct), -100, 10000);
    const afterDamageIncrease = afterCritical * (1 + enemyDamageIncreasePct / 100);
    const variance = clamp(finite(enemy.variance, 1.015), 1, 1.03);
    const afterVariance = afterDamageIncrease * variance;

    const generalDR = clamp(finite(character.damageReductionPct), 0, 100);
    const normalDR = attackKind === 'normal' ? clamp(finite(character.normalDamageReductionPct), 0, 100) : 0;
    const combinedDR = 1 - ((1 - generalDR / 100) * (1 - normalDR / 100));
    const afterDamageReduction = afterVariance * (1 - combinedDR);

    const relation = typeRelation(character.type, enemy.type);
    const guard = Boolean(character.guard);
    const typeBoostLevel = Math.round(clamp(finite(character.typeDefenseBoostLevel), 0, 15));
    const classMismatch = Boolean(character.class && enemy.class)
        && String(character.class).toLowerCase() !== String(enemy.class).toLowerCase();
    let typeAttackFactor = 1;
    let defenseFactor = 1;
    let classMultiplier = 1;
    if (guard) {
        typeAttackFactor = 0.4;
        defenseFactor = 0.5;
        if (relation === 'character-advantage') typeAttackFactor -= 0.005 * typeBoostLevel;
        if (classMismatch) classMultiplier = 1.15;
    } else if (relation === 'character-advantage') {
        typeAttackFactor = (classMismatch ? 0.5 : 0.45) - (0.005 * typeBoostLevel);
        defenseFactor = 0.5;
    } else if (relation === 'enemy-advantage') {
        typeAttackFactor = 1.25;
        if (classMismatch) classMultiplier = 1.15;
    } else if (classMismatch) {
        classMultiplier = 1.15;
    }

    // A neutral class mismatch adds 15%; the measured character type-advantage
    // pairing changes its hit factor from 0.45 to 0.50 when classes differ.
    const afterClassAndType = afterDamageReduction * classMultiplier * typeAttackFactor;

    const defense = defenseValueForHit(input);
    const defenseReductionPct = clamp(finite(enemy.defenseReductionPct), 0, 100);
    const effectiveDefense = defense.beforeEnemyReduction * (1 - defenseReductionPct / 100);
    const beforeDamageReceivedIncrease = Math.max(0, afterClassAndType - (effectiveDefense * defenseFactor));

    const domain = input.domain || {};
    const requestedDomainIncrease = clamp(finite(domain.damageReceivedIncreasePct), 0, 10000);
    const domainApplies = Boolean(domain.active) && domainEligibility.eligible === true;
    const appliedDomainIncrease = domainApplies ? requestedDomainIncrease : 0;
    const finalDamage = Math.floor(beforeDamageReceivedIncrease * (1 + appliedDomainIncrease / 100));
    return {
        attackKind,
        damage: finalDamage,
        breakdown: {
            baseEnemyAttack: attackStat,
            afterAttackStatIncrease: afterAttackStat,
            afterItemAndPassiveAttackDown: afterEnemyAttackDown,
            attackMultiplierPct: effectiveAttackMultiplierPct,
            afterAttackMultiplier,
            criticalMultiplier,
            afterDamageIncrease,
            afterVariance,
            incomingDamageBeforeCharacterDefense: afterVariance,
            damageReductionPct: combinedDR * 100,
            afterDamageReduction,
            typeRelation: relation,
            typeAttackFactor,
            classMismatch,
            classMultiplier,
            defenseFactor,
            afterClassAndType,
            defense,
            defenseReductionPct,
            effectiveDefense,
            beforeDamageReceivedIncrease,
            domainEligibility: domainEligibility.eligible,
            domainDamageReceivedIncreasePct: appliedDomainIncrease
        }
    };
}

function withHpOutcome(result, startingHp, hitCount) {
    const scenarioDamage = Number.isFinite(result.damage) ? result.damage * hitCount : NaN;
    const hasFiniteDamage = Number.isFinite(scenarioDamage);
    const hasValidStartingHp = Number.isFinite(startingHp) && startingHp > 0;
    const canCalculateHp = hasValidStartingHp && hasFiniteDamage;
    const remainingHp = canCalculateHp ? Math.max(0, startingHp - scenarioDamage) : null;
    return {
        ...result,
        scenarioHitCount: hitCount,
        scenarioDamage: hasFiniteDamage ? scenarioDamage : null,
        hp: {
            starting: hasValidStartingHp ? startingHp : null,
            remaining: remainingHp,
            remainingPct: canCalculateHp ? (remainingHp / startingHp) * 100 : null,
            overkill: canCalculateHp ? Math.max(0, scenarioDamage - startingHp) : null
        }
    };
}

export function calculateDamageReceived(input = {}) {
    const domainEligibility = resolveDomainEligibility(input);
    const character = input.character || {};
    const parsedHp = Number(character.currentHp);
    const startingHp = Number.isFinite(parsedHp) && parsedHp > 0 ? parsedHp : null;
    const normalHitCount = clamp(Math.floor(finite(input.normalAttackCount, 1)), 1, 99);
    return {
        domainEligibility,
        normal: withHpOutcome(calculateOne(input, 'normal', domainEligibility), startingHp, normalHitCount),
        super: withHpOutcome(calculateOne(input, 'super', domainEligibility), startingHp, 1)
    };
}

export { resolveDomainEligibility, typeRelation };
