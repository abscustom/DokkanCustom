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
        };
        reader.readAsDataURL(file);
    }
};

window.updateImageLink = function(url) {
    if (!selectedForm) return;
    const linkAnchor = selectedForm.querySelector(".form-link");
    if (linkAnchor) linkAnchor.href = url || "javascript:void(0)";
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

    if (imgLr) imgLr.src = "./images/LR_Icon.png";
    if (imgTur) imgTur.src = "./images/TUR_Icon.png";
    if (imgSsr) imgSsr.src = "./images/SSR_Icon.png";
    if (mainRarity) mainRarity.src = "./images/rarity_none.png";
    if (overlayImg) overlayImg.src = "images/Card Art Template.png";

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