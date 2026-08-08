/* ============================================================
   ULTIMATE DOKKAN STAT CALCULATOR
============================================================ */
const potentialBonuses = {
    agl: { hp: 4600, atk: 5000, def: 5400 },
    teq: { hp: 4600, atk: 5400, def: 5000 },
    int: { hp: 5000, atk: 5000, def: 5000 },
    str: { hp: 5000, atk: 5400, def: 4600 },
    phy: { hp: 5400, atk: 5000, def: 4600 },
    none: { hp: 0, atk: 0, def: 0 }
};

window.calculatedStats = {
    hp: { '0%': 0, '55%': 0, '69%': 0, '79%': 0, '90%': 0, '100%': 0 },
    atk: { '0%': 0, '55%': 0, '69%': 0, '79%': 0, '90%': 0, '100%': 0 },
    def: { '0%': 0, '55%': 0, '69%': 0, '79%': 0, '90%': 0, '100%': 0 }
};

window.currentAbsStatPct = window.currentAbsStatPct || '100%';

window.setAbsStatPercent = function(pct) {
    window.currentAbsStatPct = pct;
    document.querySelectorAll('.abs-stat-tab').forEach(tab => {
        if (tab.innerText.trim() === pct) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    window.updateAbsStatDisplay();
};

window.updateAbsStatDisplay = function() {
    const pct = window.currentAbsStatPct || '100%';
    const hpVal = window.calculatedStats.hp[pct] || 0;
    const atkVal = window.calculatedStats.atk[pct] || 0;
    const defVal = window.calculatedStats.def[pct] || 0;

    const hpEl = document.getElementById('abs-stat-hp-val');
    const atkEl = document.getElementById('abs-stat-atk-val');
    const defEl = document.getElementById('abs-stat-def-val');

    if (hpEl && hpVal > 0) hpEl.innerText = hpVal.toLocaleString();
    if (atkEl && atkVal > 0) atkEl.innerText = atkVal.toLocaleString();
    if (defEl && defVal > 0) defEl.innerText = defVal.toLocaleString();
};

// Aliases for compatibility
window.setDbStatPercent = window.setAbsStatPercent;
window.updateDbStatDisplay = window.updateAbsStatDisplay;

window.calcFromMax = function(statType, explicitMin = null) {
    const maxValInput = document.getElementById(`input-${statType}-max`);
    const tableMaxEl = document.getElementById(`stat-${statType}-max`);

    let baseMax = 0;
    if (maxValInput && maxValInput.value) {
        baseMax = parseInt(maxValInput.value) || 0;
    } else if (tableMaxEl) {
        baseMax = parseInt(tableMaxEl.textContent.replace(/,/g, '')) || 0;
    }

    if (baseMax === 0) return;

    const maxLvEl = document.getElementById("max-lv");
    const maxLv = maxLvEl ? (parseInt(maxLvEl.textContent) || 120) : 120;
    
    let minVal = explicitMin !== null ? explicitMin : Math.round(baseMax / 3.3);

    let growth = baseMax - minVal;
    let ezaBonus = Math.round(growth * 0.4839);
    let ezaBaseMax = baseMax + ezaBonus;

    const activeAwakening = window.currentAwakeningMode || currentAwakeningMode;
    const activeType = window.currentType || currentType;

    const isEZA = (activeAwakening === 'eza' || activeAwakening === 'seza') && maxLv !== 150;
    const effectiveBaseMax = isEZA ? ezaBaseMax : baseMax;

    const freePathBonus = 2000; 
    const rainbowBonus = potentialBonuses[activeType] ? potentialBonuses[activeType][statType] : 5000;
    const dupeBonus = Math.max(0, rainbowBonus - freePathBonus);

    const elMin = document.getElementById(`stat-${statType}-min`);
    const elMax = document.getElementById(`stat-${statType}-max`);
    const el55 = document.getElementById(`stat-${statType}-55`);
    const el100 = document.getElementById(`stat-${statType}-100`);

    if (elMin) elMin.innerText = minVal.toLocaleString();
    if (elMax) elMax.innerText = baseMax.toLocaleString();
    if (el55) el55.innerText = (baseMax + freePathBonus).toLocaleString();
    if (el100) el100.innerText = (baseMax + rainbowBonus).toLocaleString();

    const elEzaMax = document.getElementById(`stat-${statType}-eza-max`);
    const elEza100 = document.getElementById(`stat-${statType}-eza-100`);

    if (elEzaMax) elEzaMax.innerText = ezaBaseMax.toLocaleString();
    if (elEza100) elEza100.innerText = (ezaBaseMax + rainbowBonus).toLocaleString();

    // Store calculated values for interactive ABS Stats tabs
    if (!window.calculatedStats) window.calculatedStats = { hp: {}, atk: {}, def: {} };
    window.calculatedStats[statType] = {
        '0%': effectiveBaseMax,
        '55%': effectiveBaseMax + freePathBonus,
        '69%': effectiveBaseMax + freePathBonus + Math.round(dupeBonus * 0.45),
        '79%': effectiveBaseMax + freePathBonus + Math.round(dupeBonus * 0.70),
        '90%': effectiveBaseMax + freePathBonus + Math.round(dupeBonus * 0.85),
        '100%': effectiveBaseMax + rainbowBonus
    };

    window.updateAbsStatDisplay();

    const ezaCols = document.querySelectorAll('.eza-stat-col');
    if ((activeAwakening === 'eza' || activeAwakening === 'seza') && maxLv !== 150) {
        ezaCols.forEach(el => el.classList.remove('d-none'));
    } else {
        ezaCols.forEach(el => el.classList.add('d-none'));
    }
};

window.calcFromMin = window.calcFromMax;