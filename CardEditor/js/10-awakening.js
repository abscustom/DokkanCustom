

/* ============================================================
   AWAKENING MANAGER
============================================================ */
window.applyAwakening = function(mode) {
    const container = document.getElementById('awakening-container');
    const img = document.getElementById('awakening-img');
    const ezaBtn = document.getElementById('btn-eza-toggle');
    const sezaBtn = document.getElementById('btn-seza-toggle');
    
    // Sidebar Input Containers
    const ezaDateBox = document.getElementById('eza-date-input-container');
    const sezaDateBox = document.getElementById('seza-date-input-container');

    if (ezaBtn) ezaBtn.classList.remove('active-awakening');
    if (sezaBtn) sezaBtn.classList.remove('active-awakening');
    currentAwakeningMode = mode;

    if (mode === 'none') {
        if (container) container.style.display = 'none';
        if (ezaDateBox) ezaDateBox.style.display = 'none';
        if (sezaDateBox) sezaDateBox.style.display = 'none';
        window.updateSANamesWithExtreme(false);
    } else {
        if (container) container.style.display = 'block';
        if (mode === 'eza') {
            if (img) img.src = "./images/eza_img.png";
            if (ezaBtn) ezaBtn.classList.add('active-awakening');
            if (ezaDateBox) ezaDateBox.style.display = 'block';
            if (sezaDateBox) sezaDateBox.style.display = 'none';
        } else if (mode === 'seza') {
            if (img) img.src = "./images/supereza_img.png";
            if (sezaBtn) sezaBtn.classList.add('active-awakening');
            if (ezaDateBox) ezaDateBox.style.display = 'block';
            if (sezaDateBox) sezaDateBox.style.display = 'block';
        }
        window.updateSANamesWithExtreme(true);
    }

    window.updateIdentity(); 
    window.calcFromMin('hp');
    window.calcFromMin('atk');
    window.calcFromMin('def');

    // LIVE SYNC TO ABS LAYOUT
    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
};

window.updateSANamesWithExtreme = function(shouldAdd) {
    const saBlocks = document.querySelectorAll('.sa-block');
    const suffix = " (Extreme)";

    saBlocks.forEach(block => {
        const nameDisp = block.querySelector('.sa-display-name');
        if (!nameDisp) return;

        let currentName = nameDisp.textContent.trim();

        if (shouldAdd) {
            if (!currentName.toLowerCase().endsWith("(extreme)")) {
                nameDisp.textContent = currentName + suffix;
            }
        } else {
            nameDisp.textContent = currentName.replace(/\s*\(Extreme\)$/i, "");
        }
    });

    if (window.refreshSADropdown) window.refreshSADropdown();
    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
};

const originalSyncSA = window.syncSuperAttack;
window.syncSuperAttack = function() {
    if (originalSyncSA) originalSyncSA(); 
    if (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode !== 'none') {
        window.updateSANamesWithExtreme(true);
    }
};

