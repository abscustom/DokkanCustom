/* ============================================================
   2. GLOBAL WINDOW FUNCTIONS 
   ============================================================ */
window.uploadIcon = function(event, targetId) {
    const file = event.target.files[0];
    const targetImg = document.getElementById(targetId);
    if (file && targetImg) {
        const reader = new FileReader();
        reader.onload = function(e) { 
            targetImg.src = e.target.result; 
            
            // If uploading TUR icon and it's a TUR card, update the main top-left slot too
            if (targetId === 'img-tur' && currentRarity === 'TUR') {
                const mainTopLeftIcon = document.getElementById('img-lr');
                if (mainTopLeftIcon) mainTopLeftIcon.src = e.target.result;
            }

            // Immediately live sync to ABS composed icon
            const dbThumbImg = document.getElementById('abs-thumb-img');
            if (dbThumbImg) {
                const activeRarity = window.currentRarity || currentRarity;
                const isLR = activeRarity === 'LR';
                const lrThumb = document.getElementById('img-lr');
                const turThumb = document.getElementById('img-tur');
                const ssrThumb = document.getElementById('img-ssr');
                let thumbSrc = isLR ? (lrThumb ? lrThumb.src : '') : (activeRarity === 'TUR' ? (turThumb ? turThumb.src : '') : (ssrThumb ? ssrThumb.src : ''));
                dbThumbImg.src = thumbSrc || e.target.result;
            }

            if (window.syncToAbsLayout) window.syncToAbsLayout();
        };
        reader.readAsDataURL(file);
    }
};

window.updateImageLink = function(url) {
    if (!selectedForm) return;
    const linkAnchor = selectedForm.querySelector(".form-link");
    let cleanUrl = (url || "").trim();
    if (cleanUrl && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('javascript:')) {
        const slug = cleanUrl.replace(/^\/+/, '').replace(/\/+$/, '');
        cleanUrl = `https://abscustom.github.io/${slug}/`;
    }
    if (linkAnchor) linkAnchor.href = cleanUrl || "javascript:void(0)";
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.resetEditorCache = function() {
    const confirmed = confirm("Are you sure you want to RESET the editor? All unsaved progress will be permanently lost!");
    if (!confirmed) return;

    window.IS_RESETTING = true;
    window.onbeforeunload = null;

    // 1. Clear Storage Completely
    try {
        window.localStorage.clear();
        window.sessionStorage.clear();
        localStorage.removeItem('dokkan_autosave');
        localStorage.removeItem('dokkan_selected_theme');
    } catch (e) {
        console.error("Storage clear error:", e);
    }

    // 2. Reset All Text & Input Fields in DOM
    const allInputs = document.querySelectorAll('input, textarea, select');
    allInputs.forEach(el => {
        if (el.type !== 'button' && el.type !== 'submit' && el.type !== 'hidden') {
            el.value = '';
        }
    });

    // 3. Clear Dynamic Containers (Updated to ABS IDs)
    const elementsToClear = [
        "card-passive-container",
        "sidebar-sections-area",
        "card-link-container",
        "card-category-container",
        "forms-container",
        "leader-skill",
        "abs-leader-skill",
        "char-description",
        "char-name",
        "abs-char-title",
        "abs-char-name",
        "abs-passive-container",
        "abs-sa-container",
        "abs-active-container",
        "abs-link-container",
        "abs-category-container",
        "abs-awakenings-container",
        "abs-transformations-container"
    ];

    elementsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });

    // Remove all SA & Active Blocks
    document.querySelectorAll(".sa-block, .active-block").forEach(el => el.remove());

    // 4. Reset Default Card Images
    const imgLr = document.getElementById("img-lr");
    const imgTur = document.getElementById("img-tur");
    const imgSsr = document.getElementById("img-ssr");
    const mainRarity = document.getElementById("main-rarity-icon");
    const overlayImg = document.getElementById("myOverlayImage");

    if (imgLr) imgLr.src = "https://abscustom.github.io/assets/images/LR_Icon.png";
    if (imgTur) imgTur.src = "https://abscustom.github.io/assets/images/TUR_Icon.png";
    if (imgSsr) imgSsr.src = "https://abscustom.github.io/assets/images/SSR_Icon.png";
    if (mainRarity) mainRarity.src = "https://abscustom.github.io/assets/images/rarity_none.png";
    if (overlayImg) overlayImg.src = "https://abscustom.github.io/assets/images/Card Art Template.png";

    // 5. Reset Global Variables & Form Letter / Folder State
    window.currentType = "none";
    window.currentClass = "none";
    window.currentRarity = "none";
    window.currentAwakeningMode = "none";
    window.currentHubFormLetter = "a";
    window.autoDetectedFolderId = null;
    window.sIdx = 0;
    window.lIdx = 0;
    window.extractedCutins = [];
    window.scrapedAssets = {};

    // 6. Reload page with clean cache-busting URL
    setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '?reset=' + Date.now();
    }, 50);
};

/**
 * Completely resets editor state in-memory without page reload or confirm prompts.
 * Used prior to importing cards (official or custom) to guarantee a pristine slate.
 */
window.clearEditorForCleanImport = function() {
    window.currentCardThumbnail = '';

    // 1. Remove dynamic SA & Active blocks
    document.querySelectorAll(".sa-block, .active-block").forEach(el => el.remove());

    // 2. Clear dynamic HTML containers
    const elementsToClear = [
        "card-passive-container",
        "sidebar-sections-area",
        "card-link-container",
        "card-category-container",
        "forms-container",
        "leader-skill",
        "abs-leader-skill",
        "char-description",
        "char-name",
        "abs-char-title",
        "abs-char-name",
        "abs-passive-container",
        "abs-sa-container",
        "abs-active-container",
        "abs-link-container",
        "abs-category-container",
        "abs-awakenings-container",
        "abs-transformations-container",
        "release-dates-container"
    ];

    elementsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });

    // 3. Clear text & input fields
    const inputsToClear = [
        "descInput", "nameInput", "dateInput", "ezaDateInput", "sezaDateInput", "leaderInput",
        "input-hp-max", "input-atk-max", "input-def-max", "input-hp-min", "input-atk-min", "input-def-min",
        "input-passive-name-sidebar", "imageInput", "upload-folder-id"
    ];

    inputsToClear.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 4. Reset global pointers & undo stacks
    window.sIdx = 0;
    window.lIdx = 0;
    window.selectedForm = null;
    window.currentSuperAttack = null;
    window.currentActiveSkill = null;
    window.selectedStat = null;
    window.selectedListItem = null;
    window.passiveUndoStack = [];
    window.formUndoStack = [];
    window.saUndoStack = [];
    window.activeUndoStack = [];
    window.extractedCutins = [];
    window.scrapedAssets = {};

    const formList = document.getElementById('formList');
    if (formList) formList.innerHTML = "";
};

