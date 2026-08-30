/* ======================================================================= */
/*    CLICK TO EDIT GUI INTERCEPTOR (FULL CONTROLLER & COMPLETE TOOLKIT)   */
/* ======================================================================= */

function sanitizeLinksAndCategories() {
    const targets = document.querySelectorAll('#card-link-container a, #card-category-container img, #card-category-container div');
    targets.forEach(el => {
        if (el.hasAttribute('onclick')) {
            el.removeAttribute('onclick');
        }
        el.onclick = null;
    });
}

function escapeContextHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(() => {
        sanitizeLinksAndCategories();
    });

    const linkCont = document.getElementById('card-link-container');
    const catCont = document.getElementById('card-category-container');

    if (linkCont) observer.observe(linkCont, { childList: true, subtree: true });
    if (catCont) observer.observe(catCont, { childList: true, subtree: true });
    
    sanitizeLinksAndCategories();
});

window.ADMIN_MODE = false;

window.unlockAdminMode = function() {
    if (!window.IS_PUBLISHED) return;

    if (window.ADMIN_MODE) {
        window.ADMIN_MODE = false;
        document.body.classList.remove('admin-mode-active');
        const sidebar = document.getElementById('editor');
        const toggleBtn = document.getElementById('toggleBtn');
        const quickSaveBtn = document.getElementById('admin-quick-save-btn');
        const exportJsonBtn = document.getElementById('admin-export-json-btn');
        const uploadDockBtn = document.getElementById('topbar-upload-dock-wrap');

        if (sidebar) sidebar.style.display = 'none';
        if (toggleBtn) toggleBtn.style.display = 'none';
        if (quickSaveBtn) quickSaveBtn.style.setProperty('display', 'none', 'important');
        if (exportJsonBtn) exportJsonBtn.style.setProperty('display', 'none', 'important');
        if (uploadDockBtn) uploadDockBtn.style.setProperty('display', 'none', 'important');

        window.clearCardGlow();
        alert("🔒 Admin Mode Deactivated.");
        return;
    }

    document.getElementById('glass-admin-unlock-modal').style.display = 'flex';
    document.getElementById('admin-unlock-pass').value = '';
    document.getElementById('confirm-admin-unlock-btn').disabled = true;
    setTimeout(() => document.getElementById('admin-unlock-pass').focus(), 100);
};

window.closeAdminUnlockModal = function() {
    document.getElementById('glass-admin-unlock-modal').style.display = 'none';
};

window.checkAdminUnlockValidity = function() {
    const pass = document.getElementById('admin-unlock-pass').value;
    const btn = document.getElementById('confirm-admin-unlock-btn');
    btn.disabled = (pass !== "spiderman");
};

window.executeAdminUnlock = function() {
    window.closeAdminUnlockModal();
    window.ADMIN_MODE = true;
    document.body.classList.add('admin-mode-active');

    const sidebar = document.getElementById('editor');
    const toggleBtn = document.getElementById('toggleBtn');
    const quickSaveBtn = document.getElementById('admin-quick-save-btn');
    const exportJsonBtn = document.getElementById('admin-export-json-btn');
    const uploadDockBtn = document.getElementById('topbar-upload-dock-wrap');

    if (sidebar) sidebar.style.display = 'block';
    if (toggleBtn) toggleBtn.style.display = 'flex';
    if (quickSaveBtn) quickSaveBtn.style.setProperty('display', 'inline-flex', 'important');
    if (exportJsonBtn) exportJsonBtn.style.setProperty('display', 'inline-flex', 'important');
    if (uploadDockBtn) uploadDockBtn.style.setProperty('display', 'inline-block', 'important');

    ensureGUIContainerExists();
    makeGUIDraggable();

    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.unlockAdminMode();
    }
});

// Click-to-Edit Route Handler
document.addEventListener('click', function(e) {
    if (window.IS_PUBLISHED && !window.ADMIN_MODE) return;

    ensureGUIContainerExists();

    if (e.target.closest('#context-gui, #editor, nav, .navbar, #abs-stat-range-slider, .abs-slider-ticks, .glass-modal-overlay')) return;

    let editType = null;
    let target = e.target.closest('[data-edit]');

    if (target) {
        editType = target.getAttribute('data-edit');
    } else {
        if (e.target.closest('#char-name, #char-description, #abs-char-title, #abs-char-name, .abs-header-text, #release-dates-container, .abs-awaken-date')) {
            editType = 'identity';
            target = document.getElementById('release-dates-container') || e.target.closest('.abs-header-text, .abs-awaken-date') || e.target;
        } else if (e.target.closest('#leader-skill, #abs-leader-skill, [data-edit="leader"]') || (e.target.closest('.abs-box') && e.target.closest('.abs-box').querySelector('#abs-leader-skill'))) {
            editType = 'leader';
            target = e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#card-passive-container, .passive-name-display, #abs-passive-container, #abs-passive-name')) {
            editType = 'passive';
            target = e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#card-link-container, #abs-link-container, .abs-links-container, .abs-link-badge')) {
            editType = 'links';
            target = e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#card-category-container, #abs-category-container')) {
            editType = 'categories';
            target = e.target.closest('.abs-box') || e.target;
        } else if (e.target.closest('#myOverlayImage, #myOverlayVideo, .card-art-canvas, .abs-art-box, #abs-art-dock-wrapper')) {
            editType = 'art';
            target = document.getElementById('abs-art-dock-wrapper') || e.target;
        } else if (e.target.closest('#forms-container, #abs-transformations-box, .abs-transform-row')) {
            editType = 'forms';
            target = document.getElementById('forms-container') || document.getElementById('abs-transformations-box') || e.target;
        } else if (e.target.closest('#ssr-row, #tur-row, #img-ssr, #img-tur, #img-lr, .card-icon, #abs-awakenings-box, .abs-awaken-row, .abs-awaken-divider, #abs-composed-icon, #abs-top-rarity-icon, #abs-rarity-icon, #main-rarity-icon, #ssr-rarity-icon, #tur-rarity-icon, #awakening-container, #abs-awakening-img') && !e.target.closest('.abs-awaken-date')) {
            editType = 'icons';
            target = e.target.closest('.abs-box, .dokkan-card') || e.target;
        } else if (e.target.closest('table.col, #abs-stats-box, .abs-stat-cards-row, .abs-stat-slider-wrapper')) {
            editType = 'stats';
            target = document.getElementById('abs-stats-box') || e.target;
        } else if (e.target.closest('.sa-block, #abs-sa-container > div')) {
            editType = 'sa';
            let clickedBlock = e.target.closest('.sa-block');
            if (!clickedBlock) {
                const dbBlock = e.target.closest('#abs-sa-container > div');
                const dbContainer = document.getElementById('abs-sa-container');
                const dbBlocks = Array.from(dbContainer.children);
                let index = dbBlocks.indexOf(dbBlock);
                if (index === -1) index = 0;
                clickedBlock = document.querySelectorAll('.sa-block')[index];
            }
            currentSuperAttack = clickedBlock;
            target = clickedBlock || e.target.closest('#abs-sa-container > div');
        } else if (e.target.closest('.active-block, #abs-active-container > div')) {
            editType = 'active';
            let clickedActive = e.target.closest('.active-block');
            if (!clickedActive) {
                const dbActive = e.target.closest('#abs-active-container > div');
                const dbContainer = document.getElementById('abs-active-container');
                const dbActives = Array.from(dbContainer.children);
                let index = dbActives.indexOf(dbActive);
                if (index === -1) index = 0;
                clickedActive = document.querySelectorAll('.active-block')[index];
            }
            currentActiveSkill = clickedActive;
            target = clickedActive || e.target.closest('#abs-active-container > div');
        }
        target = target || e.target;
    }

    if (!editType) return;

    e.preventDefault();
    openContextGUI(e.clientX, e.clientY, editType, target);
});

window.passiveUndoStack = [];
window.saUndoStack = [];
window.activeUndoStack = [];
window.formUndoStack = [];
window.guiSelectedSAIcon = "https://abscustom.github.io/assets/images/st_0001.png";
window.collapsedPassiveSections = new Set();

function ensureGUIContainerExists() {
    if (!document.getElementById('context-gui')) {
        const guiHTML = `
        <div id="context-gui">
            <div class="gui-header">
                <span id="gui-title" class="gui-title">⚙️ Editor</span>
                <button type="button" class="gui-close" onclick="closeContextGUI()">×</button>
            </div>
            <div id="gui-content"></div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', guiHTML);
    }
    makeGUIDraggable();
}

window.closeContextGUI = function() {
    const gui = document.getElementById('context-gui');
    if (gui) gui.style.display = 'none';
    window.clearCardGlow();
};

window.highlightCardElement = function(element) {
    window.clearCardGlow();
    if (!element || (window.IS_PUBLISHED && !window.ADMIN_MODE)) return;
    const outerBox = element.closest('.dokkan-card, .abs-box, .sa-block, .active-block, .abs-header-text, .abs-art-dock-wrapper') || element;
    if (outerBox) outerBox.classList.add('active-selected-glow');
};

window.clearCardGlow = function() {
    document.querySelectorAll('.active-selected-glow').forEach(el => {
        el.classList.remove('active-selected-glow');
    });
};

function makeGUIDraggable() {
    const gui = document.getElementById('context-gui');
    if (!gui) return;
    const header = gui.querySelector('.gui-header');
    if (!header) return;

    header.style.cursor = 'move';
    let isDragging = false;
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    header.onmousedown = function(e) {
        if (e.target.closest('.gui-close')) return;
        isDragging = true;
        gui.dataset.isDragged = "true";

        const rect = gui.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        gui.style.position = 'fixed';
        gui.style.left = `${initialLeft}px`;
        gui.style.top = `${initialTop}px`;

        document.onmousemove = function(moveEvent) {
            if (!isDragging) return;
            let newLeft = initialLeft + (moveEvent.clientX - startX);
            let newTop = initialTop + (moveEvent.clientY - startY);

            const minTop = 60;
            const minLeft = 10;
            const maxLeft = Math.max(10, window.innerWidth - gui.offsetWidth - 10);
            const maxTop = Math.max(minTop, window.innerHeight - gui.offsetHeight - 10);

            if (newTop < minTop) newTop = minTop;
            if (newTop > maxTop) newTop = maxTop;
            if (newLeft < minLeft) newLeft = minLeft;
            if (newLeft > maxLeft) newLeft = maxLeft;

            gui.style.left = `${newLeft}px`;
            gui.style.top = `${newTop}px`;
        };

        document.onmouseup = function() {
            isDragging = false;
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };
}

function openContextGUI(mouseX, mouseY, editType, targetElement) {
    const gui = document.getElementById('context-gui');
    const titleEl = document.getElementById('gui-title');
    const contentEl = document.getElementById('gui-content');

    if (!gui || !titleEl || !contentEl) return;
    window.highlightCardElement(targetElement);

    let titleHTML = "";
    const cloudSvgIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:inline-block; vertical-align:-3px; margin-right:4px;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>`;
    const undoSvgIcon = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>`;
    const identitySvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;
    const crownSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"/></svg>`;
    const statsSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>`;
    const imageUploadSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
    const passiveSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`;
    const activeSkillSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 2l2.4 7.2h7.6l-6.1 4.5 2.3 7.3-6.2-4.6-6.2 4.6 2.3-7.3-6.1-4.5h7.6z"/></svg>`;
    const paletteSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l1.9-1.9C9.28 19.63 10.59 20 12 20c4.97 0 9-4.03 9-9s-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>`;
    const formsSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
    const linkSvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`;
    const categorySvgIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:-2px; margin-right:6px;"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/></svg>`;
    const lightningSvgIcon = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:inline-block; vertical-align:-1px; margin-right:4px;"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>`;
    const addSvgIcon = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    const deleteSvgIcon = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="display:inline-block; vertical-align:-1px; margin-right:3px;"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

    switch(editType) {
        case 'identity':
            titleHTML = `${identitySvgIcon} Character Identity & Options`;
            const curRarity = window.currentRarity || currentRarity;
            const curClass = window.currentClass || currentClass;
            const curType = window.currentType || currentType;
            const curAwakening = window.currentAwakeningMode || currentAwakeningMode;
            const selGlow = "background:#facc15 !important; color:#000 !important; font-weight:900 !important; border-color:#facc15 !important;";

            bodyHTML = `
                <label class="form-label mb-1">Title</label>
                <textarea id="gui-descInput" class="form-control mb-2" style="height:42px;" oninput="guiUpdateIdentityField('descInput', this.value)">${document.getElementById('descInput')?.value || document.getElementById('char-description')?.textContent || ''}</textarea>
                
                <label class="form-label mb-1">Name</label>
                <input type="text" id="gui-nameInput" class="form-control mb-2" value="${document.getElementById('nameInput')?.value || document.getElementById('char-name')?.textContent || ''}" oninput="guiUpdateIdentityField('nameInput', this.value)">
                
                <label class="form-label mb-1">Release Date</label>
                <input type="text" id="gui-dateInput" class="form-control mb-2" value="${document.getElementById('dateInput')?.value || ''}" placeholder="e.g. 9/14/2026 1:00:00 AM EDT" oninput="guiUpdateIdentityField('dateInput', this.value)">
                
                ${(curAwakening === 'eza' || curAwakening === 'seza') ? `
                    <label class="form-label mb-1">EZA Release Date</label>
                    <input type="text" id="gui-ezaDateInput" class="form-control mb-2" value="${document.getElementById('ezaDateInput')?.value || ''}" placeholder="e.g. 10/1/2026" oninput="guiUpdateIdentityField('ezaDateInput', this.value)">
                ` : ''}

                ${(curAwakening === 'seza') ? `
                    <label class="form-label mb-1">SEZA Release Date</label>
                    <input type="text" id="gui-sezaDateInput" class="form-control mb-2" value="${document.getElementById('sezaDateInput')?.value || ''}" placeholder="e.g. 11/1/2026" oninput="guiUpdateIdentityField('sezaDateInput', this.value)">
                ` : ''}

                <label class="form-label mb-1">Rarity</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curRarity === 'LR' ? selGlow : ''}" onclick="updateRarityStats('LR'); openContextGUI(0,0,'identity');">LR</button>
                    <button type="button" class="gui-preset-btn" style="${curRarity === 'TUR' ? selGlow : ''}" onclick="updateRarityStats('TUR'); openContextGUI(0,0,'identity');">TUR</button>
                </div>

                <label class="form-label mb-1">Class</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curClass === 'super' ? selGlow : ''}" onclick="currentClass='super'; updateIconImages(); openContextGUI(0,0,'identity');">Super</button>
                    <button type="button" class="gui-preset-btn" style="${curClass === 'extreme' ? selGlow : ''}" onclick="currentClass='extreme'; updateIconImages(); openContextGUI(0,0,'identity');">Extreme</button>
                </div>

                <label class="form-label mb-1">Typing</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curType === 'agl' ? selGlow : ''}" onclick="applyCardTheme('agl'); openContextGUI(0,0,'identity');">AGL</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'teq' ? selGlow : ''}" onclick="applyCardTheme('teq'); openContextGUI(0,0,'identity');">TEQ</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'int' ? selGlow : ''}" onclick="applyCardTheme('int'); openContextGUI(0,0,'identity');">INT</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'str' ? selGlow : ''}" onclick="applyCardTheme('str'); openContextGUI(0,0,'identity');">STR</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'phy' ? selGlow : ''}" onclick="applyCardTheme('phy'); openContextGUI(0,0,'identity');">PHY</button>
                </div>

                <label class="form-label mb-1">Awakening Status</label>
                <div class="gui-btn-grid mb-1">
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'none' ? selGlow : ''}" onclick="applyAwakening('none'); openContextGUI(0,0,'identity');">None</button>
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'eza' ? selGlow : ''}" onclick="applyAwakening('eza'); openContextGUI(0,0,'identity');">EZA</button>
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'seza' ? selGlow : ''}" onclick="applyAwakening('seza'); openContextGUI(0,0,'identity');">SEZA</button>
                </div>
            `;
            break;

        case 'leader':
            titleHTML = `${crownSvgIcon} Leader Skill`;
            bodyHTML = `
                <label class="form-label mb-1">Leader Skill Text</label>
                <textarea id="gui-leaderInput" class="form-control mb-2" style="height:90px;">${document.getElementById('leaderInput')?.value || document.getElementById('leader-skill')?.textContent || ''}</textarea>
                <div class="gui-btn-grid mt-2">
                    <button type="button" class="gui-preset-btn" onclick="applyLeaderPreset('dfe'); syncLeaderGUI();">DFE</button>
                    <button type="button" class="gui-preset-btn" onclick="applyLeaderPreset('carnival'); syncLeaderGUI();">Carnival</button>
                    <button type="button" class="gui-preset-btn" onclick="applyLeaderPreset('lr'); syncLeaderGUI();">Legendary Summon</button>
                </div>
            `;
            break;

        case 'stats':
            titleHTML = `${statsSvgIcon} Base Max Stats`;
            bodyHTML = `
                <label class="form-label mb-1">HP (Base Max)</label>
                <input type="number" id="gui-hp-max" class="form-control mb-2" value="${document.getElementById('input-hp-max')?.value || ''}" oninput="if(document.getElementById('input-hp-max')) document.getElementById('input-hp-max').value=this.value; calcFromMax('hp');">
                <label class="form-label mb-1">ATK (Base Max)</label>
                <input type="number" id="gui-atk-max" class="form-control mb-2" value="${document.getElementById('input-atk-max')?.value || ''}" oninput="if(document.getElementById('input-atk-max')) document.getElementById('input-atk-max').value=this.value; calcFromMax('atk');">
                <label class="form-label mb-1">DEF (Base Max)</label>
                <input type="number" id="gui-def-max" class="form-control mb-2" value="${document.getElementById('input-def-max')?.value || ''}" oninput="if(document.getElementById('input-def-max')) document.getElementById('input-def-max').value=this.value; calcFromMax('def');">
            `;
            break;

        case 'icons':
            titleHTML = `${imageUploadSvgIcon} Card Thumbnail Uploads`;
            const showLr = (window.currentRarity || currentRarity) === 'LR';
            bodyHTML = `
                <div class="d-flex justify-content-center gap-3 p-2">
                    <label class="uiverse-upload-btn m-0">
                        ${cloudSvgIcon} SSR
                        <input type="file" hidden accept="image/*" onchange="uploadIcon(event, 'img-ssr')">
                    </label>
                    <label class="uiverse-upload-btn m-0">
                        ${cloudSvgIcon} TUR
                        <input type="file" hidden accept="image/*" onchange="uploadIcon(event, 'img-tur')">
                    </label>
                    ${showLr ? `
                    <label class="uiverse-upload-btn m-0">
                        ${cloudSvgIcon} LR
                        <input type="file" hidden accept="image/*" onchange="uploadIcon(event, 'img-lr')">
                    </label>` : ''}
                </div>
            `;
            break;

        case 'passive':
            titleHTML = `${passiveSvgIcon} Passive Skill Sections`;
            // Published/older cards may have the visible passive content but
            // not the hidden sidebar fields used by the editor popup.
            if (window.ensurePassiveEditorSections) window.ensurePassiveEditorSections();
            let passiveSectionsHTML = "";
            const sidebarSections = document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]');

            sidebarSections.forEach((sec, idx) => {
                const id = parseInt(sec.id.replace('side-sec-', ''), 10);
                const headerVal = sec.querySelector('input[type="text"]')?.value || "Basic effect(s)";
                const textVal = sec.querySelector('textarea')?.value || "";
                const isCollapsed = window.collapsedPassiveSections.has(id);

                passiveSectionsHTML += `
                <div class="gui-section-box mb-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="d-flex align-items-center gap-1">
                            <button type="button" id="gui-sec-toggle-btn-${id}" class="gui-minimize-btn" onclick="guiTogglePassiveCollapse(${id})">${isCollapsed ? '+' : '−'}</button>
                            <button type="button" class="gui-minimize-btn" onclick="guiMovePassiveSection(${id}, -1)">↑</button>
                            <button type="button" class="gui-minimize-btn" onclick="guiMovePassiveSection(${id}, 1)">↓</button>
                            <label class="form-label m-0 ms-1">Section ${idx + 1}</label>
                        </div>
                        <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px;" onclick="guiDeleteSpecificPassiveSection(${id})">Delete</button>
                    </div>
                    <input type="text" id="gui-sec-header-${id}" class="form-control mb-1" value="${escapeContextHtml(headerVal)}" oninput="updateHeader(${id}, this.value)">
                    <div id="gui-sec-body-${id}" style="display: ${isCollapsed ? 'none' : 'block'};">
                        <div class="d-flex gap-1 mb-2 align-items-center flex-wrap">
                            <span style="font-size:9px; color:#aaa; font-weight:bold;">Header:</span>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#f87171;" onclick="insertShortcut('gui-sec-header-${id}', ':atk_down:');">ATK↓</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#38bdf8;" onclick="insertShortcut('gui-sec-header-${id}', ':def_down:');">DEF↓</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#facc15;" onclick="insertShortcut('gui-sec-header-${id}', ':stun:');">Stun</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#c084fc;" onclick="insertShortcut('gui-sec-header-${id}', ':seal:');">Seal</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#fb923c;" onclick="insertShortcut('gui-sec-header-${id}', ':break:');">Break</button>
                        </div>
                        <textarea id="gui-sec-text-${id}" class="form-control mb-2" style="height:110px;" oninput="document.getElementById('input-sec-${id}').value=this.value; updateSection(${id}, this.value);">${escapeContextHtml(textVal)}</textarea>
                        <div class="gui-btn-grid mb-1">
                            <button type="button" class="gui-preset-btn" onclick="insertShortcut('gui-sec-text-${id}', ':up:');">↑ Up</button>
                            <button type="button" class="gui-preset-btn" onclick="insertShortcut('gui-sec-text-${id}', ':down:');">↓ Down</button>
                            <button type="button" class="gui-preset-btn" onclick="insertShortcut('gui-sec-text-${id}', ':ydown:');">↓ Y-Down</button>
                            <button type="button" class="gui-preset-btn" onclick="insertShortcut('gui-sec-text-${id}', ':once:');">! Once</button>
                            <button type="button" class="gui-preset-btn" onclick="insertShortcut('gui-sec-text-${id}', ':inf:');">∞ Inf</button>
                        </div>
                        <div class="gui-btn-grid">
                            <button type="button" class="gui-preset-btn" style="color:#f87171;" onclick="insertShortcut('gui-sec-text-${id}', ':atk_down:');">ATK↓</button>
                            <button type="button" class="gui-preset-btn" style="color:#38bdf8;" onclick="insertShortcut('gui-sec-text-${id}', ':def_down:');">DEF↓</button>
                            <button type="button" class="gui-preset-btn" style="color:#facc15;" onclick="insertShortcut('gui-sec-text-${id}', ':stun:');">Stun</button>
                            <button type="button" class="gui-preset-btn" style="color:#c084fc;" onclick="insertShortcut('gui-sec-text-${id}', ':seal:');">Seal</button>
                            <button type="button" class="gui-preset-btn" style="color:#fb923c;" onclick="insertShortcut('gui-sec-text-${id}', ':break:');">Break</button>
                        </div>
                    </div>
                </div>`;
            });

            const isAbsTheme = (window.currentCardThemeStyle === 'abs-style');
            bodyHTML = `
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddPassiveSection()">+ Add Section</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoPassiveSection()">${undoSvgIcon}Undo</button>
                </div>
                
                ${isAbsTheme ? `
                <!-- HEADER BADGES CONTAINER (ABS STYLE ONLY) -->
                <div class="gui-section-box mb-2" style="background: #27272a; border: 1px solid #3f3f46;">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="d-flex align-items-center gap-1">
                            <button type="button" id="gui-header-badges-toggle-btn" class="gui-minimize-btn" onclick="window.togglePassiveBadgesCollapse('gui-passive-badges-toggle-strip', this)">−</button>
                            <label class="form-label m-0 ms-1" style="color: #a1a1aa; font-weight: 800; font-size: 11px;">HEADER BADGES</label>
                        </div>
                        <button type="button" class="btn-auto-detect" onclick="event.stopPropagation(); window.resetPassiveHeaderIconsToAuto(); openContextGUI(0, 0, 'passive');">Auto-Detect</button>
                    </div>

                    <!-- PASSIVE SKILL NAME (ALWAYS VISIBLE ABOVE BADGES) -->
                    <input type="text" id="gui-passive-name" class="form-control form-control-sm mb-2" placeholder="Passive Skill Name" value="${escapeContextHtml(document.getElementById('input-passive-name-sidebar')?.value || document.querySelector('.passive-name-display')?.innerText || '')}">
                    
                    <!-- COLLAPSIBLE BADGES PALETTE -->
                    <div id="gui-passive-badges-toggle-strip" class="d-flex flex-wrap gap-1 p-1" style="background: #18181b; border: 1px solid #334155; border-radius: 6px; min-height: 80px; max-height: 500px; overflow-y: auto; resize: vertical;"></div>
                </div>
                ` : `
                <!-- PASSIVE NAME ONLY (INFO STYLE) -->
                <div class="gui-section-box mb-2" style="background: #27272a; border: 1px solid #3f3f46;">
                    <label class="form-label mb-1" style="font-size: 10px;">Passive Skill Name</label>
                    <input type="text" id="gui-passive-name" class="form-control form-control-sm" placeholder="Passive Skill Name" value="${escapeContextHtml(document.getElementById('input-passive-name-sidebar')?.value || document.querySelector('.passive-name-display')?.innerText || '')}">
                </div>
                `}

                <div class="section-divider" style="border-top: 1px solid rgba(255, 255, 255, 0.15); margin: 10px 0;"></div>

                ${passiveSectionsHTML}
            `;
            break;

        case 'sa':
            titleHTML = "⚙️ Super Attack Editor";
            const isConditionActive = currentSuperAttack && !currentSuperAttack.querySelector('.activation-row')?.classList.contains('d-none');
            const saNameVal = currentSuperAttack?.querySelector('.sa-display-name')?.textContent || '';
            const saTypeVal = currentSuperAttack?.querySelector('.sa-type-label')?.textContent || 'Super Attack';
            const saIconSrc = currentSuperAttack?.querySelector('.sa-display-icon')?.getAttribute('src') || 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png';
            const saKiVal = currentSuperAttack?.getAttribute('data-ki') || '';

            let saEffectsVal = "";
            const effectCols = currentSuperAttack?.querySelectorAll('.sa-display-effects-list .col');
            if (effectCols && effectCols.length > 0) saEffectsVal = Array.from(effectCols).map(c => c.innerText).join('\n');
            const actTextVal = (typeof window.extractCleanConditionText === 'function')
                ? window.extractCleanConditionText(currentSuperAttack?.querySelector('.activation-text'))
                : (currentSuperAttack?.querySelector('.activation-text')?.innerText || '').replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();

            // Render existing stats with number input and delete button
            let saStatsHTML = "";
            if (currentSuperAttack) {
                const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
                statRows.forEach((row, sIdx) => {
                    const img = row.querySelector('img')?.getAttribute('src') || '';
                    const txt = row.querySelector('.display-text, span')?.textContent || '';
                    const numVal = txt.replace('%', '').trim();
                    saStatsHTML += `
                    <div class="d-flex justify-content-between align-items-center py-1 px-2 mb-1 gui-item-row" style="background: rgba(0,0,0,0.3); border-radius: 4px;">
                        <div class="d-flex align-items-center gap-2">
                            <img src="${img}" height="22">
                            <input type="number" class="form-control py-0 px-1" style="width: 60px; height: 24px; font-size: 11px;" value="${numVal}" oninput="guiUpdateExistingSAStat(${sIdx}, this.value)">
                            <span style="color:#38bdf8; font-weight:bold;">%</span>
                        </div>
                        <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px; font-weight:bold; height:22px;" onclick="guiDeleteExistingSAStat(${sIdx})">Delete</button>
                    </div>`;
                });
            }

            bodyHTML = `
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddSAWithAutoSelect()">${addSvgIcon} Add SA</button>
                    <button type="button" class="gui-preset-btn gui-preset-btn-danger" onclick="guiDeleteSAWithUndo()">${deleteSvgIcon} Delete SA</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoSA()">${undoSvgIcon} Undo</button>
                    <button type="button" class="gui-preset-btn" onclick="toggleSAActivationGUI()">Condition Row</button>
                </div>

                <label class="form-label mb-1">SA Type Label</label>
                <input type="text" id="gui-sa-type-custom" class="form-control mb-2" value="${saTypeVal}" oninput="guiUpdateSAType(this.value)">

                <label class="form-label mb-1">SA Name</label>
                <input type="text" id="gui-sa-name" class="form-control mb-2" value="${saNameVal}" oninput="guiUpdateSAName(this.value)">

                <!-- SA ATTACK CATEGORY ICON SELECTOR -->
                <label class="form-label mb-1">SA Attack Category Icon</label>
                <div class="d-flex gap-2 justify-content-center mb-2">
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_01.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_01') ? 'selected' : ''}" title="Ki Blast" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png')">
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_02.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_02') ? 'selected' : ''}" title="Unarmed" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_02.png')">
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_etc.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_etc') ? 'selected' : ''}" title="Other" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_etc.png')">
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_04.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_04') ? 'selected' : ''}" title="Physical" onclick="guiSetSATypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png')">
                </div>

                <label class="form-label mb-1">Ki Cost</label>
                <input type="text" id="gui-sa-ki" class="form-control mb-2" placeholder="e.g. 12 Ki" value="${saKiVal}" oninput="guiUpdateSAKi(this.value)">

                <label class="form-label mb-1">SA Effects</label>
                <textarea id="gui-sa-effects" class="form-control mb-2" style="height:70px;" oninput="guiUpdateSAEffects(this.value)">${saEffectsVal}</textarea>
                <button type="button" class="gui-preset-btn mb-2 w-100" style="background:#2563eb;" onclick="guiAutoApplySAIcons()">${lightningSvgIcon} Auto Generate Icons</button>

                ${isConditionActive ? `
                    <label class="form-label mb-1">Activation Condition <small style="opacity:0.75;">(Header is hardcoded)</small></label>
                    <textarea id="gui-sa-condition" class="form-control mb-2" style="height:50px;" placeholder="Enter condition details..." oninput="guiUpdateSAActivation(this.value)">${actTextVal}</textarea>
                ` : ''}

                <!-- COMPLETE STAT ICONS GRID -->
                <label class="form-label mb-1">Add Stat Badge</label>
                <div class="sa-gui-icon-grid mb-2">
                    <img src="https://abscustom.github.io/assets/images/st_0001.png" class="sa-gui-icon-opt selected" title="ATK Up" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0001.png')">
                    <img src="https://abscustom.github.io/assets/images/st_0002.png" class="sa-gui-icon-opt" title="DEF Up" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0002.png')">
                    <img src="https://abscustom.github.io/assets/images/st_0011.png" class="sa-gui-icon-opt" title="ATK Down" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0011.png')">
                    <img src="https://abscustom.github.io/assets/images/st_0012.png" class="sa-gui-icon-opt" title="DEF Down" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0012.png')">
                    <img src="https://abscustom.github.io/assets/images/st_0100.png" class="sa-gui-icon-opt" title="Stun" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0100.png')">
                    <img src="https://abscustom.github.io/assets/images/st_0102.png" class="sa-gui-icon-opt" title="Seal" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_0102.png')">
                    <img src="https://abscustom.github.io/assets/images/st_1009.png" class="sa-gui-icon-opt" title="Action Break" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_1009.png')">
                    <img src="https://abscustom.github.io/assets/images/st_atk_super.png" class="sa-gui-icon-opt" title="Type Effective" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_atk_super.png')">
                    <img src="https://abscustom.github.io/assets/images/pot_skill_02_on.png" class="sa-gui-icon-opt" title="Critical" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/pot_skill_02_on.png')">
                    <img src="https://abscustom.github.io/assets/images/st_evasion.png" class="sa-gui-icon-opt" title="Dodge" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_evasion.png')">
                    <img src="https://abscustom.github.io/assets/images/st_recover.png" class="sa-gui-icon-opt" title="Heal" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_recover.png')">
                    <img src="https://abscustom.github.io/assets/images/st_recover_minus.png" class="sa-gui-icon-opt" title="Sacrifice" onclick="guiSelectSAIcon(this, 'https://abscustom.github.io/assets/images/st_recover_minus.png')">
                </div>
                <div class="d-flex gap-2 mb-2">
                    <input type="number" id="gui-sa-stat-val" class="form-control" placeholder="Stat % (e.g. 30)" value="30">
                    <button type="button" class="gui-add-btn" onclick="guiAddStatIconToSA()">${addSvgIcon} Add Stat</button>
                </div>
                <div class="mb-2">${saStatsHTML}</div>
            `;
            break;

        case 'active':
            titleHTML = `${activeSkillSvgIcon} Active Skill Editor`;
            let actBlock = currentActiveSkill || document.querySelectorAll('.active-block')[0];
            const activeTypeVal = actBlock?.querySelector('.active-type-label')?.textContent || 'Active Skill';
            const activeNameVal = actBlock?.querySelector('.active-display-name')?.textContent || 'Skill Name';
            const activeEffectVal = actBlock?.querySelector('.active-display-effect')?.innerText || '';
            const activeCondVal = actBlock?.querySelector('.active-display-condition')?.innerText || '';
            const activeIconSrc = actBlock?.querySelector('.active-display-icon')?.getAttribute('src') || 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png';

            bodyHTML = `
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddActiveWithAutoSelect();">${addSvgIcon} Add Skill</button>
                    <button type="button" class="gui-preset-btn gui-preset-btn-danger" onclick="guiDeleteActiveWithUndo();">${deleteSvgIcon} Delete Skill</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoActive();">${undoSvgIcon} Undo</button>
                    <button type="button" class="gui-preset-btn" onclick="toggleActiveDividerGUI()">Divider Line</button>
                </div>

                <label class="form-label mb-1">Type Label</label>
                <input type="text" id="gui-active-type" class="form-control mb-2" value="${activeTypeVal}" oninput="guiUpdateActiveType(this.value)">

                <label class="form-label mb-1">Name</label>
                <input type="text" id="gui-active-name" class="form-control mb-2" value="${activeNameVal}" oninput="guiUpdateActiveName(this.value)">

                <!-- ACTIVE SKILL ATTACK CATEGORY ICON -->
                <label class="form-label mb-1">Active Skill Icon</label>
                <div class="d-flex gap-2 justify-content-center align-items-center mb-2">
                    <button type="button" class="sa-type-icon-opt ${(!activeIconSrc || activeIconSrc === 'none' || activeIconSrc.includes('none')) ? 'selected' : ''}" style="width: 44px; height: 44px; font-size: 10px; font-weight: 800; color: #aaa;" onclick="guiSetActiveTypeIcon(this, 'none')">NONE</button>
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_01.png" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_01') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png')">
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_02.png" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_02') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_02.png')">
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_etc.png" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_etc') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_etc.png')">
                    <img src="https://abscustom.github.io/assets/images/sp_skill_icon_04.png" class="sa-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_04') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, 'https://abscustom.github.io/assets/images/sp_skill_icon_04.png')">
                </div>

                <label class="form-label mb-1">Effect</label>
                <textarea id="gui-active-effect" class="form-control mb-2" style="height:80px;" oninput="guiUpdateActiveEffect(this.value)">${activeEffectVal}</textarea>

                <label class="form-label mb-1">Condition</label>
                <textarea id="gui-active-conditions" class="form-control" style="height:60px;" oninput="guiUpdateActiveCondition(this.value)">${activeCondVal}</textarea>
            `;
            break;

        case 'art':
            titleHTML = "⚙️ Card Art & Media";
            bodyHTML = `
                <label class="form-label mb-1">Banner Unit Tag (ABS Mode)</label>
                <select id="gui-abs-unit-tag" class="form-control mb-3" onchange="window.setAbsUnitTag?.(this.value); window.syncToAbsLayout?.(); window.autoSaveToCache?.();">
                    <option value="DOKKAN FESTIVAL UNIT" ${(window.absUnitTag === 'DOKKAN FESTIVAL UNIT' || window.absUnitTag === undefined) ? 'selected' : ''}>DOKKAN FESTIVAL UNIT</option>
                    <option value="CARNIVAL UNIT" ${window.absUnitTag === 'CARNIVAL UNIT' ? 'selected' : ''}>CARNIVAL UNIT</option>
                    <option value="LEGENDARY SUMMON UNIT" ${window.absUnitTag === 'LEGENDARY SUMMON UNIT' ? 'selected' : ''}>LEGENDARY SUMMON UNIT</option>
                    <option value="" ${window.absUnitTag === '' ? 'selected' : ''}>Hidden / None</option>
                </select>

                <div class="d-flex gap-2 mb-2">
                    <label class="uiverse-upload-btn m-0" style="flex: 1;">
                        ${cloudSvgIcon} Static Image
                        <input type="file" id="gui-imageUpload" hidden accept="image/*" onchange="document.getElementById('imageUpload').files=this.files; document.getElementById('imageUpload').dispatchEvent(new Event('change'));">
                    </label>
                    <label class="uiverse-upload-btn m-0" style="flex: 1;">
                        ${cloudSvgIcon} Video (.mp4)
                        <input type="file" id="gui-videoUpload" hidden accept="video/mp4" onchange="document.getElementById('videoUpload').files=this.files; document.getElementById('videoUpload').dispatchEvent(new Event('change'));">
                    </label>
                </div>
                <label class="form-label mb-1">Card Art Image URL</label>
                <input type="text" id="gui-imageInput" class="form-control" value="${document.getElementById('imageInput')?.value || ''}" placeholder="https://i.imgur.com/...">
            `;
            break;

        case 'forms':
            titleHTML = `${formsSvgIcon} Transformations & Forms`;
            let formsListHTML = "";
            const formCards = document.querySelectorAll('#forms-container .dokkan-card');

            let customCardOptions = "";
            try {
                const cached = localStorage.getItem('hub_cached_custom_only');
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        customCardOptions = parsed.map(c => {
                            const cardUrl = c.cardUrl || `https://abscustom.github.io/${c.id}/`;
                            return `<option value="${escapeContextHtml(cardUrl)}">${escapeContextHtml(c.name || c.id)} (${escapeContextHtml(c.id)})</option>`;
                        }).join('');
                    }
                }
            } catch(e) {}

            formCards.forEach((formCard, idx) => {
                const nameEl = formCard.querySelector('.form-name');
                const linkEl = formCard.querySelector('.form-link');
                const imageEl = formCard.querySelector('.form-image');
                const infoImageSrc = imageEl?.getAttribute('src') || imageEl?.src || 'https://abscustom.github.io/assets/images/default.png';
                const absThumbSrc = formCard.getAttribute('data-thumb-src') || infoImageSrc;
                formsListHTML += `
                <div class="gui-section-box mb-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <label class="form-label m-0">Form ${idx + 1}</label>
                        <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px;" onclick="guiDeleteSpecificForm(${idx})">Delete</button>
                    </div>
                    <div class="gui-section-box mb-2" style="background:rgba(0,0,0,0.2);">
                        <label class="form-label mb-1" style="font-size:10px;">Info-side Wide Image</label>
                        <div class="d-flex align-items-center gap-2">
                            <img id="gui-form-image-preview-${idx}" src="${escapeContextHtml(infoImageSrc)}" alt="" style="width:112px; height:58px; object-fit:contain; border-radius:6px; background:rgba(0,0,0,0.35);">
                            <label class="uiverse-upload-btn m-0" style="flex:1; justify-content:center;">
                                ${cloudSvgIcon} Upload Wide Image
                                <input type="file" hidden accept="image/*" onchange="guiUploadFormImage(${idx}, this)">
                            </label>
                        </div>
                    </div>
                    <div class="gui-section-box mb-2" style="background:rgba(0,0,0,0.2);">
                        <label class="form-label mb-1" style="font-size:10px;">ABS-style Small Thumbnail</label>
                        <div class="d-flex align-items-center gap-2">
                            <img id="gui-form-thumb-preview-${idx}" src="${escapeContextHtml(absThumbSrc)}" alt="" style="width:58px; height:58px; object-fit:contain; border-radius:6px; background:rgba(0,0,0,0.35);">
                            <label class="uiverse-upload-btn m-0" style="flex:1; justify-content:center;">
                                ${cloudSvgIcon} Upload Small Thumbnail
                                <input type="file" hidden accept="image/*" onchange="guiUploadFormThumbnail(${idx}, this)">
                            </label>
                        </div>
                    </div>
                    <label class="form-label mb-1" style="font-size:10px;">Form Character Name</label>
                    <input type="text" class="form-control mb-2" value="${escapeContextHtml(nameEl?.textContent.trim() || '')}" oninput="guiUpdateFormName(${idx}, this.value)">
                    <label class="form-label mb-1" style="font-size:10px;">Redirect Link <small style="opacity:0.75;">(Choose card or type slug e.g. evil-buu)</small></label>
                    <input type="text" list="custom-cards-form-links" class="form-control" value="${escapeContextHtml(linkEl?.getAttribute('href') || '')}" placeholder="Choose card or enter slug..." oninput="guiUpdateFormLink(${idx}, this.value)">
                </div>`;
            });

            bodyHTML = `
                <datalist id="custom-cards-form-links">
                    ${customCardOptions}
                </datalist>
                <div class="gui-btn-grid mb-3">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddForm()">${addSvgIcon} Add Form</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoForm()">${undoSvgIcon} Undo</button>
                </div>
                ${formsListHTML}
            `;
            break;

        case 'links':
            titleHTML = `${linkSvgIcon} Link Skills`;
            let linksListHTML = "";
            document.querySelectorAll('#card-link-container a').forEach((a, idx) => {
                linksListHTML += `
                <div class="d-flex justify-content-between align-items-center py-1 px-2 border-bottom border-secondary mb-1">
                    <span>${a.innerText.trim()}</span>
                    <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px;" onclick="removeLinkByIndex(${idx})">Delete</button>
                </div>`;
            });
            bodyHTML = `
                <div class="d-flex gap-2 mb-2">
                    <input list="link-options" id="gui-link-input" class="form-control" placeholder="Type link...">
                    <button type="button" class="gui-add-btn" onclick="syncLinkGUI()">${addSvgIcon} Add</button>
                </div>
                <div>${linksListHTML}</div>
            `;
            break;

        case 'categories':
            titleHTML = `${categorySvgIcon} Categories`;
            let catListHTML = "";
            document.querySelectorAll('#card-category-container img').forEach((img, idx) => {
                catListHTML += `
                <div class="d-flex justify-content-between align-items-center py-1 px-2 border-bottom border-secondary mb-1">
                    <img src="${img.src}" height="22">
                    <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px;" onclick="removeCategoryByIndex(${idx})">Delete</button>
                </div>`;
            });
            bodyHTML = `
                <div class="d-flex gap-2 mb-2">
                    <input list="category-options" id="gui-category-input" class="form-control" placeholder="Type category...">
                    <button type="button" class="gui-add-btn" onclick="syncCategoryGUI()">${addSvgIcon} Add</button>
                </div>
                <div>${catListHTML}</div>
            `;
            break;
    }

    titleEl.innerHTML = titleHTML;
    contentEl.innerHTML = bodyHTML;
    bindContextListeners(editType);
    if (editType === 'passive' && window.renderPassiveHeaderBadgeToggles) {
        window.renderPassiveHeaderBadgeToggles();
    }
    const wasOpen = (gui.style.display === 'flex' || gui.style.display === 'block');
    gui.style.display = 'flex';

    if (gui.dataset.isDragged === "true") return;

    // If modal was already open and re-rendering via button click (0, 0), keep existing position!
    if (wasOpen && (!mouseX && !mouseY)) {
        return;
    }

    if (mouseX > 0 || mouseY > 0) {
        let posX = mouseX + 20;
        let posY = mouseY - 20;
        if (posX + 460 > window.innerWidth) posX = Math.max(10, mouseX - 480);
        if (posY + 400 > window.innerHeight) posY = Math.max(65, window.innerHeight - 420);
        if (posY < 65) posY = 65;

        gui.style.left = `${posX}px`;
        gui.style.top = `${posY}px`;
    } else if (!gui.style.left || !gui.style.top || gui.style.left === '0px') {
        gui.style.left = `${Math.max(20, Math.floor((window.innerWidth - 440) / 2))}px`;
        gui.style.top = `100px`;
    }
}

// GUI HANDLERS FOR SA & ACTIVE
window.guiSetSATypeIcon = function(element, iconSrc) {
    document.querySelectorAll('.sa-type-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');
    if (currentSuperAttack) {
        const saDisplayIcon = currentSuperAttack.querySelector('.sa-display-icon');
        if (saDisplayIcon) saDisplayIcon.src = iconSrc;
    }
    const radio = document.querySelector(`input[name="sa-icon"][value="${iconSrc}"]`);
    if (radio) radio.checked = true;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.guiSelectSAIcon = function(element, iconSrc) {
    document.querySelectorAll('.sa-gui-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');
    window.guiSelectedSAIcon = iconSrc;
};

window.guiAddStatIconToSA = function() {
    if (!currentSuperAttack) return;
    const cont = currentSuperAttack.querySelector('.stats-container');
    if (!cont) return;
    const val = document.getElementById('gui-sa-stat-val')?.value || "30";
    cont.insertAdjacentHTML('beforeend', 
        `<div class="col sa-stat-row"><img class="display-img" width="50" src="${window.guiSelectedSAIcon}"><span class="display-text ms-1">${val}%</span></div>`
    );
    window.refreshStatSidebar();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'sa', currentSuperAttack);
};

window.guiUpdateExistingSAStat = function(idx, newNumber) {
    if (!currentSuperAttack) return;
    const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
    if (statRows[idx]) {
        const textSpan = statRows[idx].querySelector('.display-text, span');
        if (textSpan) textSpan.textContent = `${newNumber}%`;
    }
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.guiDeleteExistingSAStat = function(idx) {
    if (!currentSuperAttack) return;
    const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
    if (statRows[idx]) {
        statRows[idx].remove();
        window.refreshStatSidebar();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
        openContextGUI(0, 0, 'sa', currentSuperAttack);
    }
};

window.guiUpdateSAType = function(val) {
    if (!currentSuperAttack) return;
    const l = currentSuperAttack.querySelector('.sa-type-label');
    if (l) l.textContent = val;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateSAName = function(val) {
    if (!currentSuperAttack) return;
    const n = currentSuperAttack.querySelector('.sa-display-name');
    if (n) n.textContent = val;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateSAKi = function(val) {
    if (!currentSuperAttack) return;
    currentSuperAttack.setAttribute('data-ki', val);
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateSAEffects = function(val) {
    if (!currentSuperAttack) return;
    const cont = currentSuperAttack.querySelector('.sa-display-effects-list');
    if (cont) {
        const lines = val.split('\n').map(l => l.trim()).filter(Boolean);
        cont.innerHTML = lines.map(l => `<div class="row"><div class="col">${l}</div></div>`).join('');
    }
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateSAActivation = function(val) {
    if (!currentSuperAttack) return;
    const act = currentSuperAttack.querySelector('.activation-text');
    const cleanVal = (typeof window.extractCleanConditionText === 'function')
        ? window.extractCleanConditionText(val)
        : (val || "").replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
    if (act) {
        if (cleanVal === "") {
            act.innerHTML = `<strong>Activation Condition</strong>`;
        } else {
            act.innerHTML = `<strong>Activation Condition</strong><br>${cleanVal.replace(/\n/g, '<br>')}`;
        }
    }
    if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiAutoApplySAIcons = function() {
    window.autoGenerateSAIcons();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    if (currentSuperAttack) openContextGUI(0, 0, 'sa', currentSuperAttack);
};
window.toggleSAActivationGUI = function() {
    const actRow = currentSuperAttack?.querySelector('.activation-row');
    const saLv = currentSuperAttack?.querySelector('.sa-lv-container');
    if (actRow) {
        const isOpening = actRow.classList.contains('d-none');
        actRow.classList.toggle('d-none');
        if (saLv) saLv.classList.toggle('d-none');
        if (isOpening) {
            const actTextDisp = currentSuperAttack.querySelector('.activation-text');
            if (actTextDisp) {
                const cleanText = (typeof window.extractCleanConditionText === 'function')
                    ? window.extractCleanConditionText(actTextDisp)
                    : actTextDisp.innerText.replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
                if (cleanText === '') {
                    actTextDisp.innerHTML = `<strong>Activation Condition</strong>`;
                }
            }
        }
    }
    openContextGUI(0, 0, 'sa', currentSuperAttack);
};
window.guiDeleteSAWithUndo = function() {
    const blocks = document.querySelectorAll('.sa-block');
    if (blocks.length > 0) {
        window.saUndoStack.push(blocks[blocks.length - 1].outerHTML);
        blocks[blocks.length - 1].remove();
        window.refreshSADropdown();
        openContextGUI(0, 0, 'sa');
    }
};
window.guiUndoSA = function() {
    if (window.saUndoStack.length === 0) return;
    const html = window.saUndoStack.pop();
    document.getElementById('sa-insert-spot')?.insertAdjacentHTML('beforebegin', html);
    window.refreshSADropdown();
    openContextGUI(0, 0, 'sa');
};
window.guiAddSAWithAutoSelect = function() {
    window.addSuperAttackSection();
    const blocks = document.querySelectorAll('.sa-block');
    openContextGUI(0, 0, 'sa', blocks[blocks.length - 1]);
};

window.guiSetActiveTypeIcon = function(element, iconSrc) {
    document.querySelectorAll('.active-type-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');
    const act = currentActiveSkill || document.querySelector('.active-block');
    if (act) {
        let activeDisplayIcon = act.querySelector('.active-display-icon');
        if (!activeDisplayIcon) {
            activeDisplayIcon = document.createElement('img');
            activeDisplayIcon.className = 'active-display-icon d-none';
            act.appendChild(activeDisplayIcon);
        }
        activeDisplayIcon.src = (iconSrc === 'none') ? 'none' : iconSrc;
    }
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateActiveType = function(val) {
    const act = currentActiveSkill || document.querySelector('.active-block');
    if (act) act.querySelector('.active-type-label').textContent = val;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateActiveName = function(val) {
    const act = currentActiveSkill || document.querySelector('.active-block');
    if (act) act.querySelector('.active-display-name').textContent = val;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateActiveEffect = function(val) {
    const act = currentActiveSkill || document.querySelector('.active-block');
    if (act) act.querySelector('.active-display-effect').innerHTML = val.replace(/\n/g, '<br>');
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUpdateActiveCondition = function(val) {
    const act = currentActiveSkill || document.querySelector('.active-block');
    if (act) {
        const condDisp = act.querySelector('.active-display-condition');
        if (condDisp) condDisp.innerHTML = val.replace(/\n/g, '<br>');
        const condRow = act.querySelector('.active-condition-row');
        const divRow = act.querySelector('.active-divider-row');
        if (val.trim() === "") {
            if (condRow) condRow.classList.add('d-none');
            if (divRow) divRow.classList.add('d-none');
        } else {
            if (condRow) condRow.classList.remove('d-none');
            if (divRow) divRow.classList.remove('d-none');
        }
    }
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.toggleActiveDividerGUI = function() {
    const act = currentActiveSkill || document.querySelector('.active-block');
    if (act) {
        act.querySelector('.active-divider-row')?.classList.toggle('d-none');
        act.querySelector('.active-condition-row')?.classList.toggle('d-none');
        openContextGUI(0, 0, 'active', act);
    }
};
window.guiAddActiveWithAutoSelect = function() {
    window.addActiveSkillSection();
    const blocks = document.querySelectorAll('.active-block');
    openContextGUI(0, 0, 'active', blocks[blocks.length - 1]);
};
window.guiDeleteActiveWithUndo = function() {
    const blocks = document.querySelectorAll('.active-block');
    if (blocks.length > 0) {
        window.activeUndoStack.push(blocks[blocks.length - 1].outerHTML);
        blocks[blocks.length - 1].remove();
        window.refreshActiveDropdown();
        openContextGUI(0, 0, 'active');
    }
};
window.guiUndoActive = function() {
    if (window.activeUndoStack.length === 0) return;
    const html = window.activeUndoStack.pop();
    document.getElementById('active-skill-insert-spot')?.insertAdjacentHTML('beforebegin', html);
    window.refreshActiveDropdown();
    openContextGUI(0, 0, 'active');
};

window.guiTogglePassiveCollapse = function(id) {
    const body = document.getElementById(`gui-sec-body-${id}`);
    const btn = document.getElementById(`gui-sec-toggle-btn-${id}`);
    if (body) {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        if (btn) btn.textContent = isHidden ? '−' : '+';
        if (isHidden) window.collapsedPassiveSections.delete(id);
        else window.collapsedPassiveSections.add(id);
    }
};
window.guiMovePassiveSection = function(id, direction) {
    window.moveSection(id, direction);
    openContextGUI(0, 0, 'passive');
};
window.guiAddPassiveSection = function() {
    window.addNewSection();
    openContextGUI(0, 0, 'passive');
};
window.guiDeleteSpecificPassiveSection = function(id) {
    const sec = document.getElementById(`side-sec-${id}`);
    if (sec) {
        window.passiveUndoStack.push({
            header: sec.querySelector('input[type="text"]')?.value || '',
            text: sec.querySelector('textarea')?.value || ''
        });
        window.removeThisSection(id);
        openContextGUI(0, 0, 'passive');
    }
};
window.guiUndoPassiveSection = function() {
    if (window.passiveUndoStack.length === 0) return;
    const restored = window.passiveUndoStack.pop();
    window.addNewSection();
    const sections = document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]');
    const lastSec = sections[sections.length - 1];
    if (lastSec) {
        const id = lastSec.id.replace('side-sec-', '');
        const h = lastSec.querySelector('input[type="text"]');
        const t = lastSec.querySelector('textarea');
        if (h) { h.value = restored.header; window.updateHeader(id, restored.header); }
        if (t) { t.value = restored.text; window.updateSection(id, restored.text); }
    }
    openContextGUI(0, 0, 'passive');
};

window.guiAddForm = function() {
    window.addFormBlock();
    openContextGUI(0, 0, 'forms');
};
window.guiDeleteSpecificForm = function(idx) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) {
        window.formUndoStack.push(formCards[idx].outerHTML);
        formCards[idx].remove();
        window.refreshFormList();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
        openContextGUI(0, 0, 'forms');
    }
};
window.guiUndoForm = function() {
    if (window.formUndoStack.length === 0) return;
    const html = window.formUndoStack.pop();
    document.getElementById('forms-container')?.insertAdjacentHTML('beforeend', html);
    window.refreshFormList();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'forms');
};
window.guiUpdateFormName = function(idx, val) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) formCards[idx].querySelector('.form-name').textContent = val;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};
window.guiUploadFormImage = function(idx, input) {
    const file = input?.files?.[0];
    const formCard = document.querySelectorAll('#forms-container .dokkan-card')[idx];
    if (!file || !formCard) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const image = formCard.querySelector('.form-image');
        if (!image) return;
        if (!formCard.hasAttribute('data-thumb-src')) {
            formCard.setAttribute('data-thumb-src', image.getAttribute('src') || image.src || '');
        }
        image.src = event.target.result;
        image.removeAttribute('data-export-name');
        const guiPreview = document.getElementById(`gui-form-image-preview-${idx}`);
        if (guiPreview) guiPreview.src = event.target.result;
        if (window.refreshFormList) window.refreshFormList();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
    };
    reader.readAsDataURL(file);
};
window.guiUploadFormThumbnail = function(idx, input) {
    const file = input?.files?.[0];
    const formCard = document.querySelectorAll('#forms-container .dokkan-card')[idx];
    if (!file || !formCard) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        formCard.setAttribute('data-thumb-src', event.target.result);
        const guiPreview = document.getElementById(`gui-form-thumb-preview-${idx}`);
        if (guiPreview) guiPreview.src = event.target.result;
        if (window.syncToAbsLayout) window.syncToAbsLayout();
    };
    reader.readAsDataURL(file);
};
window.guiUpdateFormLink = function(idx, val) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) {
        let cleanUrl = (val || "").trim();
        if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('javascript:')) {
            const slug = cleanUrl.replace(/^\/+/, '').replace(/\/+$/, '');
            cleanUrl = `https://abscustom.github.io/${slug}/`;
        }
        formCards[idx].querySelector('.form-link').href = cleanUrl || "javascript:void(0)";
    }
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.guiUpdateIdentityField = function(fieldId, val) {
    const target = document.getElementById(fieldId);
    if (target) target.value = val;
    window.updateIdentity();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.removeLinkByIndex = function(idx) {
    const links = document.querySelectorAll('#card-link-container a');
    if (links[idx]) links[idx].remove();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'links');
};
window.removeCategoryByIndex = function(idx) {
    const cats = document.querySelectorAll('#card-category-container img');
    if (cats[idx]) cats[idx].parentElement.remove();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'categories');
};

window.syncLeaderGUI = function() {
    const gl = document.getElementById('gui-leaderInput');
    const l = document.getElementById('leaderInput');
    if (gl && l) gl.value = l.value;
};
window.syncLinkGUI = function() {
    const gl = document.getElementById('gui-link-input');
    const sl = document.getElementById('side-link-input');
    if (gl && sl) {
        sl.value = gl.value;
        window.addLinkSkill();
        gl.value = "";
        openContextGUI(0, 0, 'links');
    }
};
window.syncCategoryGUI = function() {
    const gc = document.getElementById('gui-category-input');
    const sc = document.getElementById('side-category-input');
    if (gc && sc) {
        sc.value = gc.value;
        window.addCategory();
        gc.value = "";
        openContextGUI(0, 0, 'categories');
    }
};

function bindContextListeners(editType) {
    if (editType === 'identity') {
        ['gui-descInput', 'gui-nameInput', 'gui-dateInput', 'gui-ezaDateInput', 'gui-sezaDateInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                const target = document.getElementById(id.replace('gui-', ''));
                if (target) target.value = el.value;
                window.updateIdentity();
            });
        });
    }
    if (editType === 'leader') {
        const el = document.getElementById('gui-leaderInput');
        if (el) el.addEventListener('input', () => {
            const target = document.getElementById('leaderInput');
            if (target) target.value = el.value;
            window.updateIdentity();
        });
    }
    if (editType === 'passive') {
        const el = document.getElementById('gui-passive-name');
        if (el) el.addEventListener('input', () => {
            const sb = document.getElementById('input-passive-name-sidebar');
            const cd = document.querySelector('.passive-name-display');
            if (sb) sb.value = el.value;
            if (cd) cd.innerText = el.value;
            if (window.syncToAbsLayout) window.syncToAbsLayout();
        });
    }
    if (editType === 'art') {
        const el = document.getElementById('gui-imageInput');
        if (el) el.addEventListener('input', () => {
            const target = document.getElementById('imageInput');
            if (target) target.value = el.value;
            const artBox = document.getElementById('abs-art-layers-container');
            if (artBox) delete artBox.dataset.staticArtSrc;
            const myOverlay = document.getElementById('myOverlayImage');
            if (myOverlay) myOverlay.src = el.value;
            const dbArtImg = document.getElementById('abs-art-img');
            if (dbArtImg) dbArtImg.src = el.value;
            if (window.syncToAbsLayout) window.syncToAbsLayout();
        });
    }
    if (editType === 'links') {
        document.getElementById('gui-link-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); syncLinkGUI(); }
        });
    }
    if (editType === 'categories') {
        document.getElementById('gui-category-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); syncCategoryGUI(); }
        });
    }
}
