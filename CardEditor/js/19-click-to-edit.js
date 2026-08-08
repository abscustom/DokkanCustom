

/* ======================================================================= */
/*    PERMANENTLY NEUTRALIZE CLICK-TO-DELETE ON LINKS & CATEGORIES         */
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

// PUBLISHED SITE ADMIN MODE UNLOCK LOGIC
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

    // Open Glass Admin Modal instead of prompt()
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

    // Re-trigger visual layout updates
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

// Keyboard Shortcut: Ctrl + Shift + A
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.unlockAdminMode();
    }
});

// Capture Interceptor: Opens GUI modal when clicking Links, Categories, or headers
document.addEventListener('click', function(e) {
    if (window.IS_PUBLISHED && !window.ADMIN_MODE) return;

    ensureGUIContainerExists();

    if (e.target.closest('#context-gui, #editor, nav, .navbar, .abs-stat-tabs, .abs-stat-tab, .glass-modal-overlay')) return;

    let editType = null;
    let target = e.target.closest('[data-edit]');

    if (target) {
        editType = target.getAttribute('data-edit');
    } else {
        // Character Title & Name -> IDENTITY
        if (e.target.closest('#char-name, #char-description, #abs-char-title, #abs-char-name, .abs-header-text')) {
            editType = 'identity';
            target = e.target.closest('.abs-header-text') || e.target;
        }
        // Leader Skill -> LEADER (Fixed: Supports clicking ABS Leader Header)
        else if (e.target.closest('#leader-skill, #abs-leader-skill, [data-edit="leader"]') || 
                 (e.target.closest('.abs-box') && e.target.closest('.abs-box').querySelector('#abs-leader-skill'))) {
            editType = 'leader';
            target = e.target.closest('#leader-skill, #abs-leader-skill, [data-edit="leader"]') || e.target.closest('.abs-box');
        }
        // Passive Skill -> PASSIVE
        else if (e.target.closest('#card-passive-container, .passive-name-display, #abs-passive-container, #abs-passive-name')) {
            editType = 'passive';
        }
        // Link Skills -> LINKS
        else if (e.target.closest('#card-link-container, #abs-link-container, .abs-links-container, .abs-link-badge')) {
            editType = 'links';
        }
        // Categories -> CATEGORIES
        else if (e.target.closest('#card-category-container, #abs-category-container, .abs-cat-btn')) {
            editType = 'categories';
        }
        // Card Art & Media -> ART
        else if (e.target.closest('#myOverlayImage, #myOverlayVideo, .card-art-canvas, .abs-art-box')) {
            editType = 'art';
        }
        // Forms & Transformations -> FORMS
        else if (e.target.closest('#forms-container, #forms-container .dokkan-card, #abs-transformations-box, .abs-transform-row')) {
            editType = 'forms';
            target = document.getElementById('forms-container') || document.getElementById('abs-transformations-box') || e.target;
        }
        // SSR, TUR, LR Icons & Awakening Icons -> ICONS
        else if (e.target.closest('#ssr-row, #tur-row, #img-ssr, #img-tur, #img-lr, .card-icon, #abs-awakenings-box, .abs-awaken-row, .abs-awaken-divider, #abs-composed-icon, #abs-top-rarity-icon, #abs-rarity-icon, #main-rarity-icon, #ssr-rarity-icon, #tur-rarity-icon, #awakening-container, #abs-awakening-img')) {
            editType = 'icons';
            target = e.target.closest('.row.d-flex.flex-wrap.border.card-icon, #abs-awakenings-box, .dokkan-card, .abs-box') || e.target;
        }
        // Stats Table & Cards -> STATS
        else if (e.target.closest('table.col, .abs-stats-table, #abs-stats-box, .abs-stat-cards-row')) {
            editType = 'stats';
        }
        // Super Attack -> SA
        else if (e.target.closest('.sa-block, #abs-sa-container > div, .dokkan-abs-sa-section')) {
            editType = 'sa';
            let clickedBlock = e.target.closest('.sa-block');
            
            if (!clickedBlock) {
                const dbBlock = e.target.closest('#abs-sa-container > div, .dokkan-abs-sa-section');
                const dbContainer = document.getElementById('abs-sa-container');
                const dbBlocks = Array.from(dbContainer.children);
                let index = dbBlocks.indexOf(dbBlock);
                if (index === -1) index = 0;
                clickedBlock = document.querySelectorAll('.sa-block')[index];
            }

            currentSuperAttack = clickedBlock;
            
            const saBlocks = Array.from(document.querySelectorAll('.sa-block'));
            const idx = saBlocks.indexOf(clickedBlock);
            if (idx !== -1) {
                const sel = document.getElementById('sa-selector');
                if (sel) { sel.value = idx.toString(); }
                if (window.handleSASelection) window.handleSASelection();
            }
            target = clickedBlock || e.target.closest('#abs-sa-container > div');
        }
        // Active Skill -> ACTIVE
        else if (e.target.closest('.active-block, #abs-active-container > div, .dokkan-abs-active-section')) {
            editType = 'active';
            let clickedActive = e.target.closest('.active-block');
            
            if (!clickedActive) {
                const dbActive = e.target.closest('#abs-active-container > div, .dokkan-abs-active-section');
                const dbContainer = document.getElementById('abs-active-container');
                const dbActives = Array.from(dbContainer.children);
                let index = dbActives.indexOf(dbActive);
                if (index === -1) index = 0;
                clickedActive = document.querySelectorAll('.active-block')[index];
            }

            currentActiveSkill = clickedActive;
            
            const activeBlocks = Array.from(document.querySelectorAll('.active-block'));
            const idx = activeBlocks.indexOf(clickedActive);
            if (idx !== -1) {
                const sel = document.getElementById('active-selector');
                if (sel) { sel.value = idx.toString(); }
                if (window.handleActiveSelection) window.handleActiveSelection();
            }
            target = clickedActive || e.target.closest('#abs-active-container > div');
        }
        
        target = target || e.target;
    }

    if (!editType) return;

    e.preventDefault();
    openContextGUI(e.clientX, e.clientY, editType, target);
});

/* ======================================================================= */
/*               SMART MOUSE CONTEXT GUI CONTROLLER                        */
/* ======================================================================= */

window.passiveUndoStack = [];
window.saUndoStack = [];
window.activeUndoStack = [];
window.formUndoStack = [];
window.guiSelectedSAIcon = "./images/st_0001.png";
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
    if (!element) return;
    
    if (window.IS_PUBLISHED && !window.ADMIN_MODE) return;

    // Target ONLY outer container boxes so inner items never glow individually
    let outerBox = null;
    if (element.closest('#abs-char-title, #abs-char-name, .abs-header-text')) {
        outerBox = element.closest('.abs-header-text');
    } else if (element.closest('#forms-container, #abs-transformations-box, .abs-transform-row')) {
        outerBox = document.getElementById('forms-container') || document.getElementById('abs-transformations-box');
    } else if (element.closest('#ssr-row, #tur-row, .card-icon, #abs-awakenings-box, .abs-awaken-row, .abs-awaken-divider, #abs-composed-icon, #abs-top-rarity-icon, #abs-rarity-icon, #main-rarity-icon, #ssr-rarity-icon, #tur-rarity-icon, #awakening-container, #abs-awakening-img')) {
        outerBox = element.closest('.row.d-flex.flex-wrap.border.card-icon, #abs-awakenings-box, .dokkan-card, .abs-box');
    } else {
        outerBox = element.closest('.dokkan-card, .abs-box, .sa-block, .active-block, .card-art-canvas') || element;
    }

    if (outerBox) {
        outerBox.classList.add('active-selected-glow');
    }
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
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

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
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

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

    header.ontouchstart = function(e) {
        const touch = e.touches[0];
        if (!touch || e.target.closest('.gui-close')) return;
        isDragging = true;
        gui.dataset.isDragged = "true";

        const rect = gui.getBoundingClientRect();
        startX = touch.clientX;
        startY = touch.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;

        gui.style.position = 'fixed';

        document.ontouchmove = function(moveEvent) {
            const t = moveEvent.touches[0];
            if (!isDragging || !t) return;
            const deltaX = t.clientX - startX;
            const deltaY = t.clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

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

        document.ontouchend = function() {
            isDragging = false;
            document.ontouchmove = null;
            document.ontouchend = null;
        };
    };
}

document.addEventListener("DOMContentLoaded", function() {
    ensureGUIContainerExists();
});

// PASSIVE RE-ORDERING HELPER
window.guiMovePassiveSection = function(id, direction) {
    const sidebarSections = document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]');
    sidebarSections.forEach(sec => {
        const secId = parseInt(sec.id.replace('side-sec-', ''), 10);
        const guiHeaderInput = document.getElementById(`gui-sec-header-${secId}`);
        const guiTextInput = document.getElementById(`gui-sec-text-${secId}`);
        if (guiHeaderInput && window.updateHeader) {
            window.updateHeader(secId, guiHeaderInput.value);
        }
        if (guiTextInput && window.updateSection) {
            window.updateSection(secId, guiTextInput.value);
        }
    });

    const sideSec = document.getElementById("side-sec-" + id);
    const cardSec = document.getElementById("card-sec-" + id);

    if (sideSec && cardSec) {
        if (direction === -1) { 
            const prevSide = sideSec.previousElementSibling;
            const prevCard = cardSec.previousElementSibling;
            if (prevSide && prevCard) {
                sideSec.parentNode.insertBefore(sideSec, prevSide);
                cardSec.parentNode.insertBefore(cardSec, prevCard);
            }
        } else if (direction === 1) { 
            const nextSide = sideSec.nextElementSibling;
            const nextCard = cardSec.nextElementSibling;
            if (nextSide && nextCard) {
                sideSec.parentNode.insertBefore(nextSide, sideSec);
                cardSec.parentNode.insertBefore(nextCard, cardSec);
            }
        }
    }

    if (window.reindexSections) window.reindexSections();
    if (window.syncToAbsLayout) window.syncToAbsLayout();

    openContextGUI(0, 0, 'passive');
};

// OPEN POPUP GUI (WITH STRICT SCREEN-BOUNDARY CLIPPING PROTECTION)
function openContextGUI(mouseX, mouseY, editType, targetElement) {
    const gui = document.getElementById('context-gui');
    const titleEl = document.getElementById('gui-title');
    const contentEl = document.getElementById('gui-content');

    if (!gui || !titleEl || !contentEl) return;

    window.highlightCardElement(targetElement);

    let titleHTML = "";
    let bodyHTML = "";

    // Standard Cloud Upload SVG Icon
    const cloudSvgIcon = `<svg viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>`;

    switch(editType) {
        case 'identity':
            titleHTML = "⚙️ Character Identity & Options";

            const curRarity = window.currentRarity || currentRarity;
            const curClass = window.currentClass || currentClass;
            const curType = window.currentType || currentType;
            const curAwakening = window.currentAwakeningMode || currentAwakeningMode;

            // Gold glowing active button style
            const selGlowStyle = "background:#facc15 !important; color:#000 !important; font-weight:900 !important; border-color:#facc15 !important; box-shadow:0 0 10px rgba(250,204,21,0.8) !important;";

            bodyHTML = `
                <label class="form-label mb-1">Title</label>
                <textarea id="gui-descInput" class="form-control mb-2" style="height:42px;">${document.getElementById('descInput')?.value || document.getElementById('char-description')?.textContent || ''}</textarea>
                
                <label class="form-label mb-1">Name</label>
                <input type="text" id="gui-nameInput" class="form-control mb-2" value="${document.getElementById('nameInput')?.value || document.getElementById('char-name')?.textContent || ''}">
                
                <label class="form-label mb-1">Release Date</label>
                <input type="text" id="gui-dateInput" class="form-control mb-2" value="${document.getElementById('dateInput')?.value || ''}">
                
                ${(curAwakening === 'eza' || curAwakening === 'seza') ? `
                    <label class="form-label mb-1">EZA Release Date</label>
                    <input type="text" id="gui-ezaDateInput" class="form-control mb-2" value="${document.getElementById('ezaDateInput')?.value || ''}">
                ` : ''}

                ${(curAwakening === 'seza') ? `
                    <label class="form-label mb-1">SEZA Release Date</label>
                    <input type="text" id="gui-sezaDateInput" class="form-control mb-2" value="${document.getElementById('sezaDateInput')?.value || ''}">
                ` : ''}

                <label class="form-label mb-1">Rarity</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curRarity === 'LR' ? selGlowStyle : ''}" onclick="updateRarityStats('LR'); openContextGUI(0,0,'identity');">LR</button>
                    <button type="button" class="gui-preset-btn" style="${curRarity === 'TUR' ? selGlowStyle : ''}" onclick="updateRarityStats('TUR'); openContextGUI(0,0,'identity');">TUR</button>
                </div>

                <label class="form-label mb-1">Class</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curClass === 'super' ? selGlowStyle : ''}" onclick="currentClass='super'; updateIconImages(); openContextGUI(0,0,'identity');">Super</button>
                    <button type="button" class="gui-preset-btn" style="${curClass === 'extreme' ? selGlowStyle : ''}" onclick="currentClass='extreme'; updateIconImages(); openContextGUI(0,0,'identity');">Extreme</button>
                </div>

                <label class="form-label mb-1">Typing</label>
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="${curType === 'agl' ? selGlowStyle : ''}" onclick="applyCardTheme('agl'); openContextGUI(0,0,'identity');">AGL</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'teq' ? selGlowStyle : ''}" onclick="applyCardTheme('teq'); openContextGUI(0,0,'identity');">TEQ</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'int' ? selGlowStyle : ''}" onclick="applyCardTheme('int'); openContextGUI(0,0,'identity');">INT</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'str' ? selGlowStyle : ''}" onclick="applyCardTheme('str'); openContextGUI(0,0,'identity');">STR</button>
                    <button type="button" class="gui-preset-btn" style="${curType === 'phy' ? selGlowStyle : ''}" onclick="applyCardTheme('phy'); openContextGUI(0,0,'identity');">PHY</button>
                </div>

                <label class="form-label mb-1">Awakening Status</label>
                <div class="gui-btn-grid mb-1">
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'none' ? selGlowStyle : ''}" onclick="applyAwakening('none'); openContextGUI(0,0,'identity');">None</button>
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'eza' ? selGlowStyle : ''}" onclick="applyAwakening('eza'); openContextGUI(0,0,'identity');">EZA</button>
                    <button type="button" class="gui-preset-btn" style="${curAwakening === 'seza' ? selGlowStyle : ''}" onclick="applyAwakening('seza'); openContextGUI(0,0,'identity');">SEZA</button>
                </div>
            `;
            break;

        case 'leader':
            titleHTML = "⚙️ Leader Skill";
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
            titleHTML = "⚙️ Base Max Stats";
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
            titleHTML = "⚙️ Card Thumbnail Icon Uploads";
            const activeCardRarity = (window.currentRarity || currentRarity || 'TUR');
            const showLrUpload = (activeCardRarity === 'LR');

            bodyHTML = `
                <div class="p-2 mb-1 mx-auto" style="background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); width: fit-content; max-width: 100%;">
                    <div class="d-flex align-items-center justify-content-center gap-3 flex-wrap">
                        <div class="d-flex flex-column align-items-center">
                            <label class="form-label mb-1 text-center" style="font-size: 10.5px; color: #facc15 !important; margin-top: 0 !important;">SSR Icon</label>
                            <label class="uiverse-upload-btn m-0" style="min-width: 90px; min-height: 40px; padding: 4px 8px !important; font-size: 10px !important;">
                                ${cloudSvgIcon}
                                Upload
                                <input type="file" hidden accept="image/*" onchange="uploadIcon(event, 'img-ssr')">
                            </label>
                        </div>

                        <div class="d-flex flex-column align-items-center">
                            <label class="form-label mb-1 text-center" style="font-size: 10.5px; color: #facc15 !important; margin-top: 0 !important;">TUR Icon</label>
                            <label class="uiverse-upload-btn m-0" style="min-width: 90px; min-height: 40px; padding: 4px 8px !important; font-size: 10px !important;">
                                ${cloudSvgIcon}
                                Upload
                                <input type="file" hidden accept="image/*" onchange="uploadIcon(event, 'img-tur')">
                            </label>
                        </div>

                        ${showLrUpload ? `
                            <div class="d-flex flex-column align-items-center">
                                <label class="form-label mb-1 text-center" style="font-size: 10.5px; color: #facc15 !important; margin-top: 0 !important;">LR Icon</label>
                                <label class="uiverse-upload-btn m-0" style="min-width: 90px; min-height: 40px; padding: 4px 8px !important; font-size: 10px !important;">
                                    ${cloudSvgIcon}
                                    Upload
                                    <input type="file" hidden accept="image/*" onchange="uploadIcon(event, 'img-lr')">
                                </label>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            break;

        case 'passive':
            titleHTML = "⚙️ Passive Skill Sections";
            let passiveSectionsHTML = "";
            const sidebarSections = document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]');

            if (!window.collapsedPassiveSections) window.collapsedPassiveSections = new Set();

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
                            <button type="button" class="gui-minimize-btn" onclick="guiMovePassiveSection(${id}, -1)" title="Move Up">↑</button>
                            <button type="button" class="gui-minimize-btn" onclick="guiMovePassiveSection(${id}, 1)" title="Move Down">↓</button>
                            <label class="form-label m-0 ms-1">Section ${idx + 1} Header</label>
                        </div>
                        <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px; font-weight:bold; height:22px;" onclick="guiDeleteSpecificPassiveSection(${id})">Delete Section</button>
                    </div>
                    <input type="text" id="gui-sec-header-${id}" class="form-control mb-1" value="${headerVal}" oninput="updateHeader(${id}, this.value); if(window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();">

                    <div id="gui-sec-body-${id}" style="display: ${isCollapsed ? 'none' : 'block'};">
                        <!-- Header Icons shortcut row INSIDE gui-sec-body so it collapses too -->
                        <div class="d-flex gap-1 mb-2 align-items-center flex-wrap">
                            <span style="font-size:9px; color:#aaa; font-weight:bold; margin-right:2px;">Header Icons:</span>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#f87171;" onclick="insertShortcut('gui-sec-header-${id}', ':atk_down:');">ATK↓</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#38bdf8;" onclick="insertShortcut('gui-sec-header-${id}', ':def_down:');">DEF↓</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#facc15;" onclick="insertShortcut('gui-sec-header-${id}', ':stun:');">Stun</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#c084fc;" onclick="insertShortcut('gui-sec-header-${id}', ':seal:');">Seal</button>
                            <button type="button" class="gui-preset-btn" style="padding:2px 4px; font-size:9px; color:#fb923c;" onclick="insertShortcut('gui-sec-header-${id}', ':break:');">Break</button>
                        </div>

                        <label class="form-label mb-1">Section Effects</label>
                        <textarea id="gui-sec-text-${id}" class="form-control mb-2" style="height:120px; font-size: 13px; line-height: 1.5;" oninput="document.getElementById('input-sec-${id}').value=this.value; updateSection(${id}, this.value); if(window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();">${textVal}</textarea>

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

            bodyHTML = `
                <div class="gui-btn-grid mb-3">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddPassiveSection()">+ Add Section</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoPassiveSection()">↩️ Undo Delete</button>
                </div>

                <label class="form-label mb-1">Passive Skill Name</label>
                <input type="text" id="gui-passive-name" class="form-control mb-3" value="${document.getElementById('input-passive-name-sidebar')?.value || document.querySelector('.passive-name-display')?.innerText || ''}">
                ${passiveSectionsHTML}
            `;
            break;

        case 'sa':
            titleHTML = "⚙️ Super Attack Editor";

            const isConditionActive = currentSuperAttack && !currentSuperAttack.querySelector('.activation-row')?.classList.contains('d-none');
            const saCondGlowStyle = isConditionActive 
                ? "background: linear-gradient(180deg, #059669 0%, #022c22 100%); border-color: #34d399; color: #fff; box-shadow: 0 0 14px rgba(16,185,129,0.85), inset 0 0 8px rgba(52,211,153,0.4);" 
                : "background: linear-gradient(180deg, #1f2937 0%, #111827 100%); border-color: rgba(16, 185, 129, 0.5);";

            const saNameVal = currentSuperAttack?.querySelector('.sa-display-name')?.textContent || '';
            const saTypeVal = currentSuperAttack?.querySelector('.sa-type-label')?.textContent || 'Super Attack';
            const saIconSrc = currentSuperAttack?.querySelector('.sa-display-icon')?.getAttribute('src') || './images/sp_skill_icon_01.png';
            const saKiVal = currentSuperAttack?.getAttribute('data-ki') || '';
            
            const saPresets = ["Super Attack", "Ultra Super Attack", "Ex Super Attack", "Unit Super Attack", "Unit Ultra Super Attack"];
            const isCustomSaType = !saPresets.includes(saTypeVal);

            let saEffectsVal = "";
            const effectCols = currentSuperAttack?.querySelectorAll('.sa-display-effects-list .col');
            if (effectCols && effectCols.length > 0) {
                saEffectsVal = Array.from(effectCols).map(c => c.innerText).join('\n');
            }

            const actTextVal = currentSuperAttack?.querySelector('.activation-text')?.innerText?.replace(/^Activation Conditions?\s*/i, '').trim() || '';

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
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddSAWithAutoSelect()">+ Add SA</button>
                    <button type="button" class="gui-preset-btn gui-preset-btn-danger" onclick="guiDeleteSAWithUndo()">- Delete SA</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoSA()">↩️ Undo Delete</button>
                    <button type="button" class="gui-preset-btn ${isConditionActive ? 'active-glow-btn' : ''}" style="${saCondGlowStyle}" onclick="toggleSAActivationGUI()">Condition Row</button>
                </div>

                <label class="form-label mb-1">SA Type Label</label>
                <select id="gui-sa-type-dropdown" class="form-control mb-2" onchange="guiHandleSATypeDropdownChange(this.value)">
                    <option value="Super Attack" ${saTypeVal === 'Super Attack' ? 'selected' : ''}>Super Attack</option>
                    <option value="Ultra Super Attack" ${saTypeVal === 'Ultra Super Attack' ? 'selected' : ''}>Ultra Super Attack</option>
                    <option value="Ex Super Attack" ${saTypeVal === 'Ex Super Attack' ? 'selected' : ''}>Ex Super Attack</option>
                    <option value="Unit Super Attack" ${saTypeVal === 'Unit Super Attack' ? 'selected' : ''}>Unit Super Attack</option>
                    <option value="Unit Ultra Super Attack" ${saTypeVal === 'Unit Ultra Super Attack' ? 'selected' : ''}>Unit Ultra Super Attack</option>
                    <option value="custom" ${isCustomSaType ? 'selected' : ''}>Custom...</option>
                </select>

                <div id="gui-sa-type-custom-container" style="display: ${isCustomSaType ? 'block' : 'none'};">
                    <input type="text" id="gui-sa-type-custom" class="form-control mb-2" placeholder="Type custom SA label..." value="${isCustomSaType ? saTypeVal : ''}" oninput="guiUpdateSAType(this.value)">
                </div>

                <label class="form-label mb-1">SA Name</label>
                <input type="text" id="gui-sa-name" class="form-control mb-2" value="${saNameVal}" oninput="guiUpdateSAName(this.value)">

                <label class="form-label mb-1">SA Attack Icon Type</label>
                <div class="d-flex gap-2 justify-content-center mb-2">
                    <img src="./images/sp_skill_icon_01.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_01') ? 'selected' : ''}" onclick="guiSetSATypeIcon(this, './images/sp_skill_icon_01.png')">
                    <img src="./images/sp_skill_icon_02.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_02') ? 'selected' : ''}" onclick="guiSetSATypeIcon(this, './images/sp_skill_icon_02.png')">
                    <img src="./images/sp_skill_icon_etc.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_etc') ? 'selected' : ''}" onclick="guiSetSATypeIcon(this, './images/sp_skill_icon_etc.png')">
                    <img src="./images/sp_skill_icon_04.png" class="sa-type-icon-opt ${saIconSrc.includes('sp_skill_icon_04') ? 'selected' : ''}" onclick="guiSetSATypeIcon(this, './images/sp_skill_icon_04.png')">
                </div>
                
                <label class="form-label mb-1">Ki Requirement (for ABS Damage Multiplier)</label>
                <input type="text" id="gui-sa-ki" class="form-control mb-2" placeholder="e.g., 12 Ki (Leave blank to auto-detect)" value="${saKiVal}" oninput="guiUpdateSAKi(this.value)">

                <label class="form-label mb-1">SA Effects (One per line)</label>
                <textarea id="gui-sa-effects" class="form-control mb-1" style="height:70px;" oninput="guiUpdateSAEffects(this.value)">${saEffectsVal}</textarea>
                <button type="button" class="gui-preset-btn mb-2 w-100" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); font-size: 11px; padding: 6px;" onclick="guiAutoApplySAIcons()">⚡ Auto Apply Icons</button>

                ${isConditionActive ? `
                    <label class="form-label mb-1">Activation Condition</label>
                    <textarea id="gui-sa-condition" class="form-control mb-2" style="height:50px;" oninput="guiUpdateSAActivation(this.value)">${actTextVal}</textarea>
                ` : ''}

                <label class="form-label mb-1">Stat Icons & Values</label>
                <div class="sa-gui-icon-grid mb-2">
                    <img src="./images/st_0001.png" class="sa-gui-icon-opt selected" onclick="guiSelectSAIcon(this, './images/st_0001.png')">
                    <img src="./images/st_0002.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_0002.png')">
                    <img src="./images/st_0011.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_0011.png')">
                    <img src="./images/st_0100.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_0100.png')">
                    <img src="./images/st_0102.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_0102.png')">
                    <img src="./images/st_1009.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_1009.png')">
                    <img src="./images/st_0012.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_0012.png')">
                    <img src="./images/st_atk_super.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_atk_super.png')">
                    <img src="./images/pot_skill_02_on.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/pot_skill_02_on.png')">
                    <img src="./images/st_evasion.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_evasion.png')">
                    <img src="./images/st_recover.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_recover.png')">
                    <img src="./images/st_recover_minus.png" class="sa-gui-icon-opt" onclick="guiSelectSAIcon(this, './images/st_recover_minus.png')">
                </div>
                <div class="d-flex gap-2 mb-2">
                    <input type="number" id="gui-sa-stat-val" class="form-control" placeholder="Stat % (e.g. 30)" value="30">
                    <button type="button" class="gui-add-btn" onclick="guiAddStatIconToSA()">+ Add Stat</button>
                </div>
                <div class="mb-2">${saStatsHTML}</div>
            `;
            break;

        case 'active':
            titleHTML = "⚙️ Active / Standby / Domain Skill";

            let targetActiveBlock = currentActiveSkill;
            if (!targetActiveBlock) {
                const activeBlocks = document.querySelectorAll('.active-block');
                if (activeBlocks.length > 0) targetActiveBlock = activeBlocks[activeBlocks.length - 1];
            }

            const activeTypeVal = targetActiveBlock?.querySelector('.active-type-label')?.textContent || 'Active Skill';
            const activeNameVal = targetActiveBlock?.querySelector('.active-display-name')?.textContent || 'Skill Name';
            const activeEffectVal = targetActiveBlock?.querySelector('.active-display-effect')?.innerText || '';
            const activeCondTitleVal = targetActiveBlock?.querySelector('.active-display-condition-title')?.textContent || 'Activation Condition(s)';
            const activeCondVal = targetActiveBlock?.querySelector('.active-display-condition')?.innerText || '';
            const activeIconSrc = targetActiveBlock?.querySelector('.active-display-icon')?.getAttribute('src') || './images/sp_skill_icon_04.png';

            const isDividerActive = targetActiveBlock && !targetActiveBlock.querySelector('.active-divider-row')?.classList.contains('d-none');
            const activeDividerGlowStyle = isDividerActive 
                ? "background: linear-gradient(180deg, #059669 0%, #022c22 100%); border-color: #34d399; color: #fff; box-shadow: 0 0 14px rgba(16,185,129,0.85), inset 0 0 8px rgba(52,211,153,0.4);" 
                : "background: linear-gradient(180deg, #1f2937 0%, #111827 100%); border-color: rgba(16, 185, 129, 0.5);";

            bodyHTML = `
                <div class="gui-btn-grid mb-2">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddActiveWithAutoSelect();">+ Add Skill</button>
                    <button type="button" class="gui-preset-btn gui-preset-btn-danger" onclick="guiDeleteActiveWithUndo();">- Delete Skill</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoActive();">↩️ Undo Delete</button>
                    <button type="button" class="gui-preset-btn ${isDividerActive ? 'active-glow-btn' : ''}" style="${activeDividerGlowStyle}" onclick="toggleActiveDividerGUI()">Divider Line</button>
                </div>

                <label class="form-label mb-1">Skill Type (Active / Standby / Domain)</label>
                <input type="text" id="gui-active-type" class="form-control mb-2" value="${activeTypeVal}" oninput="guiUpdateActiveType(this.value)">

                <label class="form-label mb-1">Skill Name</label>
                <input type="text" id="gui-active-name" class="form-control mb-2" value="${activeNameVal}" oninput="guiUpdateActiveName(this.value)">

                <label class="form-label mb-1">Active Skill Icon</label>
                <div class="d-flex gap-2 justify-content-center align-items-center mb-2">
                    <button type="button" class="sa-type-icon-opt active-type-icon-opt ${(!activeIconSrc || activeIconSrc === 'none' || activeIconSrc.includes('none')) ? 'selected' : ''}" style="width: 44px; height: 44px; font-size: 10px; font-weight: 800; color: #aaa; background: rgba(0,0,0,0.5); border: 2px solid rgba(16, 185, 129, 0.3); border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;" onclick="guiSetActiveTypeIcon(this, 'none')">NONE</button>
                    <img src="./images/sp_skill_icon_01.png" class="sa-type-icon-opt active-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_01') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, './images/sp_skill_icon_01.png')">
                    <img src="./images/sp_skill_icon_02.png" class="sa-type-icon-opt active-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_02') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, './images/sp_skill_icon_02.png')">
                    <img src="./images/sp_skill_icon_etc.png" class="sa-type-icon-opt active-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_etc') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, './images/sp_skill_icon_etc.png')">
                    <img src="./images/sp_skill_icon_04.png" class="sa-type-icon-opt active-type-icon-opt ${activeIconSrc.includes('sp_skill_icon_04') ? 'selected' : ''}" onclick="guiSetActiveTypeIcon(this, './images/sp_skill_icon_04.png')">
                </div>

                <label class="form-label mb-1">Effect</label>
                <textarea id="gui-active-effect" class="form-control mb-2" style="height:80px;" oninput="guiUpdateActiveEffect(this.value)">${activeEffectVal}</textarea>

                <label class="form-label mb-1">Condition Header</label>
                <input type="text" id="gui-active-cond-title" class="form-control mb-2" value="${activeCondTitleVal}" oninput="guiUpdateActiveCondTitle(this.value)">

                <label class="form-label mb-1">Condition Text</label>
                <textarea id="gui-active-conditions" class="form-control" style="height:60px;" oninput="guiUpdateActiveCondition(this.value)">${activeCondVal}</textarea>
            `;
            break;

         case 'art':
            titleHTML = "⚙️ Card Art & Media";
            const isDbModeArt = window.currentCardThemeStyle === 'abs-style';

            bodyHTML = `
                ${isDbModeArt ? `
                    <label class="form-label mb-1">Card Art Header Tag (ABS Mode)</label>
                    <select id="gui-abs-unit-tag" class="form-control mb-3" onchange="window.absUnitTag=this.value; if(window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();">
                        <option value="DOKKAN FESTIVAL UNIT" ${(window.absUnitTag === 'DOKKAN FESTIVAL UNIT' || window.absUnitTag === undefined) ? 'selected' : ''}>DOKKAN FESTIVAL UNIT</option>
                        <option value="CARNIVAL UNIT" ${window.absUnitTag === 'CARNIVAL UNIT' ? 'selected' : ''}>CARNIVAL UNIT</option>
                        <option value="LEGENDARY SUMMON UNIT" ${window.absUnitTag === 'LEGENDARY SUMMON UNIT' ? 'selected' : ''}>LEGENDARY SUMMON UNIT</option>
                        <option value="" ${window.absUnitTag === '' ? 'selected' : ''}>None / Hidden</option>
                    </select>
                ` : ''}

                <label class="form-label mb-1">Upload Media</label>
                <!-- SIDE-BY-SIDE FLEXBOX FOR UPLOAD BUTTONS -->
                <div style="display: flex; gap: 10px; width: 100%; margin-bottom: 12px;">
                    <label class="uiverse-upload-btn m-0" style="flex: 1; min-width: 0; padding: 8px 4px !important;">
                        ${cloudSvgIcon}
                        <span>Static Image</span>
                        <input type="file" id="gui-imageUpload" hidden accept="image/*" onchange="document.getElementById('imageUpload').files=this.files; document.getElementById('imageUpload').dispatchEvent(new Event('change'));">
                    </label>
                    
                    <label class="uiverse-upload-btn m-0" style="flex: 1; min-width: 0; padding: 8px 4px !important;">
                        ${cloudSvgIcon}
                        <span>Video (.mp4)</span>
                        <input type="file" id="gui-videoUpload" hidden accept="video/mp4" onchange="document.getElementById('videoUpload').files=this.files; document.getElementById('videoUpload').dispatchEvent(new Event('change'));">
                    </label>
                </div>
                
                <label class="form-label mb-1">Card Art URL (Imgur 426 x 568)</label>
                <input type="text" id="gui-imageInput" class="form-control" value="${document.getElementById('imageInput')?.value || ''}" placeholder="https://i.imgur.com/...">
            `;
            break;

        case 'forms':
            titleHTML = "⚙️ Transformations & Forms";
            let formsListHTML = "";
            const formCards = document.querySelectorAll('#forms-container .dokkan-card');
            const isDbMode = window.currentCardThemeStyle === 'abs-style';

            // Card-Wide Active Hub Letter (default 'a')
            const activeCardLetter = (window.currentHubFormLetter || document.querySelector('meta[name="hub-id"]')?.getAttribute('content') || 'a').toLowerCase();

            // SINGLE TOP CARD HUB LETTER SELECTOR ABOVE BUTTONS
            const letters = ['a', 'b', 'c', 'd', 'e'];
            let topLetterSelectorHTML = `
                <div class="d-flex align-items-center justify-content-between p-2 mb-2" style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.18); border-radius: 6px;">
                    <span style="font-size:11px; color:#fff; font-weight:800; letter-spacing:0.5px;">Card Hub Letter:</span>
                    <div class="d-flex gap-1">`;
            
            letters.forEach(l => {
                const isSel = (l === activeCardLetter);
                const selStyle = isSel
                    ? "background:#facc15 !important; color:#000 !important; font-weight:900 !important; border-color:#facc15 !important; box-shadow:0 0 10px rgba(250,204,21,0.8) !important;"
                    : "background:rgba(255,255,255,0.08) !important; color:#aaa !important; border-color:rgba(255,255,255,0.2) !important;";
                topLetterSelectorHTML += `<button type="button" class="gui-preset-btn py-0 px-2" style="font-size:11px; min-width:30px; height:24px; ${selStyle}" onclick="guiSetCardHubLetter('${l}')">${l.toUpperCase()}</button>`;
            });
            topLetterSelectorHTML += `</div></div>`;

            formCards.forEach((formCard, idx) => {
                if (isDbMode && idx === 0) return;

                const nameEl = formCard.querySelector('.form-name');
                const linkEl = formCard.querySelector('.form-link');

                const currentName = nameEl ? nameEl.textContent.trim() : `Form ${idx + 1}`;
                const currentLink = linkEl ? linkEl.getAttribute('href') : "https://abscustom.github.io/";

                // Compact Upload button placed side-by-side with the Redirect URL input box
                const uploadBtnHTML = isDbMode ? `
                    <label class="uiverse-upload-btn m-0" title="Upload Card Icon / Portrait (ABS Mode)">
                        ${cloudSvgIcon}
                        Icon
                        <input type="file" hidden accept="image/*" onchange="guiUploadFormAbsThumb(${idx}, event)">
                    </label>
                ` : `
                    <label class="uiverse-upload-btn m-0" title="Upload Form Cutin (Info Mode)">
                        ${cloudSvgIcon}
                        Cutin
                        <input type="file" hidden accept="image/*" onchange="guiUploadFormImage(${idx}, event)">
                    </label>
                `;

                formsListHTML += `
                <div class="gui-section-box mb-2">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <label class="form-label m-0">Form ${idx + 1} Name</label>
                        <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px;" onclick="guiDeleteSpecificForm(${idx})">Delete</button>
                    </div>
                    <input type="text" class="form-control mb-2" value="${currentName}" oninput="guiUpdateFormName(${idx}, this.value)">

                    <label class="form-label mb-1">Redirect Link URL & Media</label>
                    <div class="d-flex align-items-center gap-2 mb-1">
                        <input type="text" class="form-control" style="flex: 1;" value="${currentLink}" placeholder="Redirect URL..." oninput="guiUpdateFormLink(${idx}, this.value)">
                        ${uploadBtnHTML}
                    </div>
                </div>`;
            });

            bodyHTML = `
                ${topLetterSelectorHTML}
                <div class="gui-btn-grid mb-3">
                    <button type="button" class="gui-preset-btn" style="background:#2563eb;" onclick="guiAddForm()">+ Add Form</button>
                    <button type="button" class="gui-preset-btn" style="background:#15803d;" onclick="guiUndoForm()">↩️ Undo Delete</button>
                </div>
                ${formsListHTML}
            `;
            break;

        case 'links':
            titleHTML = "⚙️ Link Skills";
            let linksListHTML = "";
            const linkElements = document.querySelectorAll('#card-link-container a');
            
            linkElements.forEach((a, idx) => {
                const linkName = a.innerText.trim();
                if (!linkName) return;
                
                linksListHTML += `
                <div class="d-flex justify-content-between align-items-center py-1.5 px-2 border-bottom border-secondary border-opacity-25 mb-1 gui-item-row">
                    <div class="abs-link-badge">
                        <div class="abs-link-lv">
                            <span class="lv-text">Lv</span>
                            <span class="num-text">10</span>
                        </div>
                        <div class="abs-link-name">${linkName}</div>
                    </div>
                    <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px; font-weight:bold; height:22px;" onclick="removeLinkByIndex(${idx})">Delete</button>
                </div>`;
            });

            bodyHTML = `
                <div class="d-flex gap-2 mb-2">
                    <input list="link-options" id="gui-link-input" class="form-control" placeholder="Search link skill...">
                    <button type="button" class="gui-add-btn" onclick="syncLinkGUI()">+ Add</button>
                </div>
                <div class="gui-scroll-list mb-2">${linksListHTML}</div>
            `;
            break;

        case 'categories':
            titleHTML = "⚙️ Categories";
            let catListHTML = "";
            document.querySelectorAll('#card-category-container img').forEach((img, idx) => {
                catListHTML += `
                <div class="d-flex justify-content-between align-items-center py-1.5 px-2 border-bottom border-secondary border-opacity-25 mb-1 gui-item-row">
                    <div class="d-flex align-items-center justify-content-center flex-grow-1 me-2">
                        <img src="${img.src}" height="24" style="object-fit: contain;">
                    </div>
                    <button type="button" class="btn btn-danger btn-sm py-0 px-2" style="font-size:10px; font-weight:bold; height:22px;" onclick="removeCategoryByIndex(${idx})">Delete</button>
                </div>`;
            });

            bodyHTML = `
                <div class="d-flex gap-2 mb-2">
                    <input list="category-options" id="gui-category-input" class="form-control" placeholder="Type category...">
                    <button type="button" class="gui-add-btn" onclick="syncCategoryGUI()">+ Add</button>
                </div>
                <div class="gui-scroll-list mb-2">${catListHTML}</div>
            `;
            break;
        }

    titleEl.innerHTML = titleHTML;
    contentEl.innerHTML = bodyHTML;

    bindContextListeners(editType);

    gui.style.display = 'flex';

    // PRESERVE DRAGGED POSITION IF USER MOVED THE BOX
    if (gui.dataset.isDragged === "true") {
        return;
    }

    const guiWidth = gui.offsetWidth || 540;
    const guiHeight = gui.offsetHeight || 520;

    let posX = mouseX + 20;
    let posY = mouseY - 20;

    if (targetElement && targetElement.getBoundingClientRect) {
        const rect = targetElement.getBoundingClientRect();
        posX = rect.right + 15;
        posY = rect.top;
    }

    // Horizontal Boundary Check
    if (posX + guiWidth > window.innerWidth - 15) {
        if (targetElement && targetElement.getBoundingClientRect) {
            posX = Math.max(10, targetElement.getBoundingClientRect().left - guiWidth - 15);
        } else {
            posX = Math.max(10, mouseX - guiWidth - 15);
        }
    }

    // Vertical Boundary Check (Strict Bottom-Clipping Protection)
    if (posY + guiHeight > window.innerHeight - 15) {
        posY = Math.max(65, window.innerHeight - guiHeight - 20);
    }

    if (posY < 65) posY = 65;
    if (posX < 10) posX = 10;

    gui.style.left = `${posX}px`;
    gui.style.top = `${posY}px`;
}

// REALTIME SA EDIT HELPERS
window.guiUpdateSAType = function(val) {
    if (!currentSuperAttack) return;
    const l = currentSuperAttack.querySelector('.sa-type-label');
    if (l) l.textContent = val;
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

window.guiUpdateSAName = function(val) {
    if (!currentSuperAttack) return;
    const n = currentSuperAttack.querySelector('.sa-display-name');
    if (n) n.textContent = val;
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

window.guiUpdateSAKi = function(val) {
    if (!currentSuperAttack) return;
    currentSuperAttack.setAttribute('data-ki', val);
    if (window.currentCardThemeStyle === 'abs-style' && window.updateAbsStyleSuperAttacks) {
        window.updateAbsStyleSuperAttacks();
    }
};

window.guiUpdateSAEffects = function(val) {
    if (!currentSuperAttack) return;
    const cont = currentSuperAttack.querySelector('.sa-display-effects-list');
    if (cont) {
        const lines = val.split('\n').map(l => l.trim()).filter(Boolean);
        cont.innerHTML = lines.map(l => `<div class="row"><div class="col">${l}</div></div>`).join('');
    }
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

// REALTIME ACTIVE EDIT HELPERS
window.guiUpdateActiveType = function(val) {
    let block = currentActiveSkill || document.querySelectorAll('.active-block')[0];
    if (!block) return;
    const t = block.querySelector('.active-type-label');
    if (t) t.textContent = val;
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

window.guiUpdateActiveName = function(val) {
    let block = currentActiveSkill || document.querySelectorAll('.active-block')[0];
    if (!block) return;
    const n = block.querySelector('.active-display-name');
    if (n) n.textContent = val;
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

window.guiUpdateActiveEffect = function(val) {
    let block = currentActiveSkill || document.querySelectorAll('.active-block')[0];
    if (!block) return;
    const e = block.querySelector('.active-display-effect');
    if (e) e.innerHTML = val.replace(/\n/g, '<br>');
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

window.guiUpdateActiveCondTitle = function(val) {
    let block = currentActiveSkill || document.querySelectorAll('.active-block')[0];
    if (!block) return;
    const ct = block.querySelector('.active-display-condition-title');
    if (ct) ct.textContent = val;
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

window.guiUpdateActiveCondition = function(val) {
    let block = currentActiveSkill || document.querySelectorAll('.active-block')[0];
    if (!block) return;
    const c = block.querySelector('.active-display-condition');
    if (c) c.innerHTML = val.replace(/\n/g, '<br>');
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
};

// PASSIVE SECTION MANAGER
window.guiTogglePassiveCollapse = function(id) {
    if (!window.collapsedPassiveSections) window.collapsedPassiveSections = new Set();
    const body = document.getElementById(`gui-sec-body-${id}`);
    const btn = document.getElementById(`gui-sec-toggle-btn-${id}`);
    if (!body) return;
    
    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (btn) btn.textContent = '−';
        window.collapsedPassiveSections.delete(id);
    } else {
        body.style.display = 'none';
        if (btn) btn.textContent = '+';
        window.collapsedPassiveSections.add(id);
    }
};

window.guiAddPassiveSection = function() {
    window.addNewSection();
    const sections = document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]');
    const lastSec = sections[sections.length - 1];
    openContextGUI(0, 0, 'passive', lastSec);
};

window.guiDeleteSpecificPassiveSection = function(id) {
    const sec = document.getElementById(`side-sec-${id}`);
    if (!sec) return;

    const headerVal = sec.querySelector('input[type="text"]')?.value || "";
    const textVal = sec.querySelector('textarea')?.value || "";

    window.passiveUndoStack.push({ header: headerVal, text: textVal });
    window.removeThisSection(id);
    openContextGUI(0, 0, 'passive');
};

window.guiUndoPassiveSection = function() {
    if (window.passiveUndoStack.length === 0) return;
    const restored = window.passiveUndoStack.pop();
    window.addNewSection();
    
    const sections = document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]');
    const lastSec = sections[sections.length - 1];
    if (lastSec) {
        const id = lastSec.id.replace('side-sec-', '');
        const hInput = lastSec.querySelector('input[type="text"]');
        const tInput = lastSec.querySelector('textarea');
        if (hInput) { hInput.value = restored.header; window.updateHeader(id, restored.header); }
        if (tInput) { tInput.value = restored.text; window.updateSection(id, restored.text); }
    }
    openContextGUI(0, 0, 'passive');
};

window.guiSetActiveTypeIcon = function(element, iconSrc) {
    document.querySelectorAll('.active-type-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');

    if (currentActiveSkill) {
        let activeDisplayIcon = currentActiveSkill.querySelector('.active-display-icon');
        if (!activeDisplayIcon) {
            activeDisplayIcon = document.createElement('img');
            activeDisplayIcon.className = 'active-display-icon d-none';
            currentActiveSkill.appendChild(activeDisplayIcon);
        }
        activeDisplayIcon.src = (iconSrc === 'none') ? 'none' : iconSrc;
    }

    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
};

window.guiSetSATypeIcon = function(element, iconSrc) {
    document.querySelectorAll('.sa-type-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');

    if (currentSuperAttack) {
        const saDisplayIcon = currentSuperAttack.querySelector('.sa-display-icon');
        if (saDisplayIcon) saDisplayIcon.src = iconSrc;
    }

    const radio = document.querySelector(`input[name="sa-icon"][value="${iconSrc}"]`);
    if (radio) radio.checked = true;

    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
};

window.guiUpdateSAActivation = function(val) {
    const inputAct = document.getElementById('input-activation');
    const cleanVal = val.replace(/^Activation Conditions?\s*/i, '').trim();
    
    if (inputAct) {
        inputAct.value = cleanVal;
    }
    
    let saBlock = currentSuperAttack;
    if (!saBlock) {
        const blocks = document.querySelectorAll('.sa-block');
        if (blocks.length > 0) saBlock = blocks[blocks.length - 1];
    }
    
    if (saBlock) {
        const actTextDisp = saBlock.querySelector('.activation-text');
        if (actTextDisp) {
            if (cleanVal === "") {
                actTextDisp.innerHTML = `<strong>Activation Condition</strong>`;
            } else {
                actTextDisp.innerHTML = `<strong>Activation Condition</strong><br>${cleanVal.replace(/\n/g, '<br>')}`;
            }
        }
    }

    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
};

window.guiSelectSAIcon = function(element, iconSrc) {
    document.querySelectorAll('.sa-gui-icon-opt').forEach(img => img.classList.remove('selected'));
    element.classList.add('selected');
    window.guiSelectedSAIcon = iconSrc;
};

window.guiAddSAWithAutoSelect = function() {
    window.addSuperAttackSection();
    const saBlocks = document.querySelectorAll('.sa-block');
    const newBlock = saBlocks[saBlocks.length - 1];
    if (newBlock) {
        openContextGUI(0, 0, 'sa', newBlock);
    }
};

window.guiUpdateExistingSAStat = function(idx, newNumber) {
    if (!currentSuperAttack) return;
    const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
    if (statRows[idx]) {
        const textSpan = statRows[idx].querySelector('.display-text');
        if (textSpan) textSpan.textContent = `${newNumber}%`;
    }
    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
};

window.guiDeleteExistingSAStat = function(idx) {
    if (!currentSuperAttack) return;
    const statRows = currentSuperAttack.querySelectorAll('.sa-stat-row');
    if (statRows[idx]) {
        statRows[idx].remove();
        window.refreshStatSidebar();
        if (window.currentCardThemeStyle === 'abs-style') {
            window.syncToAbsLayout();
        }
        openContextGUI(0, 0, 'sa');
    }
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
    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
    openContextGUI(0, 0, 'sa');
};

window.toggleSAActivationGUI = function() {
    const blocks = document.querySelectorAll('.sa-block');
    let targetBlock = currentSuperAttack;
    if (!targetBlock && blocks.length > 0) targetBlock = blocks[blocks.length - 1];

    if (targetBlock) {
        const actRow = targetBlock.querySelector('.activation-row');
        const saLvArea = targetBlock.querySelector('.sa-lv-container');

        if (actRow && saLvArea) {
            if (actRow.classList.contains('d-none')) {
                actRow.classList.remove('d-none');
                saLvArea.classList.add('d-none');
            } else {
                actRow.classList.add('d-none');
                saLvArea.classList.remove('d-none');
            }
            openContextGUI(0, 0, 'sa', targetBlock);
        }
    }
};

window.guiDeleteSAWithUndo = function() {
    const blocks = document.querySelectorAll('.sa-block');
    if (blocks.length > 0) {
        const lastBlock = blocks[blocks.length - 1];
        window.saUndoStack.push(lastBlock.outerHTML);
        lastBlock.remove();
        window.refreshSADropdown();
        openContextGUI(0, 0, 'sa');
    }
};

window.guiUndoSA = function() {
    if (window.saUndoStack.length === 0) return;
    const restoredHTML = window.saUndoStack.pop();
    const spot = document.getElementById('sa-insert-spot');
    if (spot) {
        spot.insertAdjacentHTML('beforebegin', restoredHTML);
        
        const saBlocks = document.querySelectorAll('.sa-block');
        const restoredBlock = saBlocks[saBlocks.length - 1];
        
        window.applyCardTheme(currentType);
        window.refreshSADropdown();
        
        if (restoredBlock) {
            currentSuperAttack = restoredBlock;
            const idx = Array.from(saBlocks).indexOf(restoredBlock);
            const sel = document.getElementById('sa-selector');
            if (sel) sel.value = idx.toString();
            window.handleSASelection();
        }
        
        if (window.currentCardThemeStyle === 'abs-style') {
            window.syncToAbsLayout();
        }
        
        openContextGUI(0, 0, 'sa', restoredBlock);
    }
};

// ACTIVE SKILL MANAGERS & UNDO
window.guiAddActiveWithAutoSelect = function() {
    window.addActiveSkillSection();
    const blocks = document.querySelectorAll('.active-block');
    const newBlock = blocks[blocks.length - 1];
    if (newBlock) {
        openContextGUI(0, 0, 'active', newBlock);
    }
};

window.guiDeleteActiveWithUndo = function() {
    const blocks = document.querySelectorAll('.active-block');
    if (blocks.length > 0) {
        const lastBlock = blocks[blocks.length - 1];
        window.activeUndoStack.push(lastBlock.outerHTML);
        lastBlock.remove();
        window.refreshActiveDropdown();
        openContextGUI(0, 0, 'active');
    }
};

window.guiUndoActive = function() {
    if (window.activeUndoStack.length === 0) return;
    const restoredHTML = window.activeUndoStack.pop();
    const spot = document.getElementById('active-skill-insert-spot');
    if (spot) {
        spot.insertAdjacentHTML('beforebegin', restoredHTML);
        
        const blocks = document.querySelectorAll('.active-block');
        const restoredBlock = blocks[blocks.length - 1];
        
        window.applyCardTheme(currentType);
        window.refreshActiveDropdown();
        
        if (restoredBlock) {
            currentActiveSkill = restoredBlock;
            const idx = Array.from(blocks).indexOf(restoredBlock);
            const sel = document.getElementById('active-selector');
            if (sel) sel.value = idx.toString();
            window.handleActiveSelection();
        }
        
        if (window.currentCardThemeStyle === 'abs-style') {
            window.syncToAbsLayout();
        }
        
        openContextGUI(0, 0, 'active', restoredBlock);
    }
};

window.toggleActiveDividerGUI = function() {
    const blocks = document.querySelectorAll('.active-block');
    let targetBlock = currentActiveSkill;
    if (!targetBlock && blocks.length > 0) targetBlock = blocks[blocks.length - 1];
    
    if (targetBlock) {
        const divRow = targetBlock.querySelector('.active-divider-row');
        const condRow = targetBlock.querySelector('.active-condition-row');
        if (divRow) divRow.classList.toggle('d-none');
        if (condRow) condRow.classList.toggle('d-none');
        
        openContextGUI(0, 0, 'active', targetBlock);
    }
};

// GLOBAL CARD HUB LETTER HANDLER
window.guiSetCardHubLetter = function(letter) {
    const cleanLetter = letter.toLowerCase();
    window.currentHubFormLetter = cleanLetter;

    // Update meta tag if present
    const hubMeta = document.querySelector('meta[name="hub-id"]');
    if (hubMeta) hubMeta.setAttribute('content', cleanLetter);

    // Update data-hub-letter attribute on all form rows
    document.querySelectorAll('#forms-container .dokkan-card').forEach(formCard => {
        formCard.setAttribute('data-hub-letter', cleanLetter);
    });

    openContextGUI(0, 0, 'forms');
};

// FORMS MANAGER
window.guiAddForm = function() {
    window.addFormBlock();
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    const newForm = formCards[formCards.length - 1];
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    openContextGUI(0, 0, 'forms', newForm);
};

window.guiUpdateFormName = function(idx, val) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) {
        const nameEl = formCards[idx].querySelector('.form-name');
        if (nameEl) nameEl.textContent = val;
    }
    if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.guiUploadFormImage = function(idx, event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const formCards = document.querySelectorAll('#forms-container .dokkan-card');
        if (formCards[idx]) {
            const imgEl = formCards[idx].querySelector('.form-image');
            if (imgEl) {
                imgEl.src = e.target.result;
                imgEl.removeAttribute('data-export-name');
            }
            if (window.syncToAbsLayout) window.syncToAbsLayout();
        }
    };
    reader.readAsDataURL(file);
};

window.guiUpdateFormLink = function(idx, val) {
    const formCards = document.querySelectorAll('#forms-container .dokkan-card');
    if (formCards[idx]) {
        const linkEl = formCards[idx].querySelector('.form-link');
        if (linkEl) linkEl.href = val || "javascript:void(0)";
    }
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
    const restoredHTML = window.formUndoStack.pop();
    const container = document.getElementById('forms-container');
    if (container) {
        container.insertAdjacentHTML('beforeend', restoredHTML);
        window.refreshFormList();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
        openContextGUI(0, 0, 'forms');
    }
};

// ITEM REMOVAL HELPERS
window.removeLinkByIndex = function(index) {
    const links = document.querySelectorAll('#card-link-container a');
    if (links[index]) links[index].remove();
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
    openContextGUI(0, 0, 'links');
};

window.removeCategoryByIndex = function(index) {
    const cats = document.querySelectorAll('#card-category-container img');
    if (cats[index]) cats[index].parentElement.remove();
    if (window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
    openContextGUI(0, 0, 'categories');
};

// REALTIME LISTENERS & ENTER KEY HANDLERS FOR LINKS/CATEGORIES
function bindContextListeners(editType) {
    if (editType === 'identity') {
        ['gui-descInput', 'gui-nameInput', 'gui-dateInput', 'gui-ezaDateInput', 'gui-sezaDateInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => {
                const targetId = id.replace('gui-', '');
                const target = document.getElementById(targetId);
                if (target) {
                    target.value = el.value;
                    target.setAttribute('value', el.value);
                }
                window.updateIdentity();
                if (window.currentCardThemeStyle === 'abs-style') { 
                    window.syncToAbsLayout(); 
                }
            });
        });
    }

    if (editType === 'leader') {
        const el = document.getElementById('gui-leaderInput');
        if (el) el.addEventListener('input', () => {
            const target = document.getElementById('leaderInput');
            if (target) {
                target.value = el.value;
                target.textContent = el.value;
                target.setAttribute('value', el.value);
            }
            window.updateIdentity();
            if(window.currentCardThemeStyle === 'abs-style') { window.syncToAbsLayout(); }
        });
    }

    if (editType === 'passive') {
        const el = document.getElementById('gui-passive-name');
        if (el) el.addEventListener('input', () => {
            const sidebarInput = document.getElementById('input-passive-name-sidebar');
            const cardDisplay = document.querySelector('.passive-name-display');
            if (sidebarInput) {
                sidebarInput.value = el.value;
                sidebarInput.setAttribute('value', el.value);
            }
            if (cardDisplay) cardDisplay.innerText = el.value;
            if(window.currentCardThemeStyle === 'abs-style') { window.syncToAbsLayout(); }
        });
    }

    if (editType === 'art') {
        const el = document.getElementById('gui-imageInput');
        if (el) el.addEventListener('input', () => {
            const target = document.getElementById('imageInput');
            if (target) {
                target.value = el.value;
                target.setAttribute('value', el.value);
                document.getElementById('myOverlayImage').src = el.value;
                if(window.currentCardThemeStyle === 'abs-style') window.syncToAbsLayout();
            }
        });
    }

    if (editType === 'links') {
        const guiLinkInput = document.getElementById('gui-link-input');
        if (guiLinkInput) {
            guiLinkInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    syncLinkGUI();
                }
            });
        }
    }

    if (editType === 'categories') {
        const guiCatInput = document.getElementById('gui-category-input');
        if (guiCatInput) {
            guiCatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    syncCategoryGUI();
                }
            });
        }
    }
}

window.syncLeaderGUI = function() {
    const guiLeader = document.getElementById('gui-leaderInput');
    const leaderInput = document.getElementById('leaderInput');
    if (guiLeader && leaderInput) guiLeader.value = leaderInput.value;
};

window.syncLinkGUI = function() {
    const guiInput = document.getElementById('gui-link-input');
    const sideInput = document.getElementById('side-link-input');
    if (guiInput && sideInput) {
        sideInput.value = guiInput.value;
        window.addLinkSkill();
        guiInput.value = "";
        openContextGUI(0, 0, 'links');
    }
};

window.syncCategoryGUI = function() {
    const guiInput = document.getElementById('gui-category-input');
    const sideInput = document.getElementById('side-category-input');
    if (guiInput && sideInput) {
        sideInput.value = guiInput.value;
        window.addCategory();
        guiInput.value = "";
        openContextGUI(0, 0, 'categories');
    }
};

window.guiAutoApplySAIcons = function() {
    const guiEffects = document.getElementById('gui-sa-effects');
    const inputEffects = document.getElementById('input-sa-effects');
    
    if (guiEffects && inputEffects) {
        inputEffects.value = guiEffects.value;
    }
    
    window.guiUpdateSAEffects(guiEffects ? guiEffects.value : "");
    window.autoGenerateSAIcons();
    
    if (window.currentCardThemeStyle === 'abs-style') {
        window.syncToAbsLayout();
    }
    
    if (currentSuperAttack) {
        openContextGUI(0, 0, 'sa', currentSuperAttack);
    }
};

window.guiUploadFormAbsThumb = function(idx, event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const formCards = document.querySelectorAll('#forms-container .dokkan-card');
        if (formCards[idx]) {
            formCards[idx].setAttribute('data-thumb-src', e.target.result);
            if (window.currentCardThemeStyle === 'abs-style') {
                window.syncToAbsLayout();
            }
        }
    };
    reader.readAsDataURL(file);
};

window.guiUploadFormImage = function(idx, event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const formCards = document.querySelectorAll('#forms-container .dokkan-card');
        if (formCards[idx]) {
            const imgEl = formCards[idx].querySelector('.form-image');
            if (imgEl) {
                imgEl.src = e.target.result;
                imgEl.removeAttribute('data-export-name');
            }
            if (window.syncToAbsLayout) window.syncToAbsLayout();
        }
    };
    reader.readAsDataURL(file);
};

window.guiHandleSATypeDropdownChange = function(val) {
    const customContainer = document.getElementById('gui-sa-type-custom-container');
    const customInput = document.getElementById('gui-sa-type-custom');
    
    if (val === 'custom') {
        if (customContainer) customContainer.style.display = 'block';
        if (customInput) {
            customInput.focus();
            window.guiUpdateSAType(customInput.value || "Super Attack");
        }
    } else {
        if (customContainer) customContainer.style.display = 'none';
        window.guiUpdateSAType(val);
    }
};
