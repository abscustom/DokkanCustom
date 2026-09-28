/* ============================================================
   2. GLOBAL WINDOW FUNCTIONS 
   ============================================================ */
window.uploadIcon = function(event, targetId) {
    const file = event.target.files[0];
    const targetImg = document.getElementById(targetId);
    if (file && targetImg) {
        const reader = new FileReader();
        reader.onload = function(e) { 
            // A manual thumbnail replaces the official progression artwork, so
            // its ABS Clean circle must use the uploaded image rather than a
            // previous card's resolved circle asset.
            delete targetImg.dataset.absCleanCircleSrc;
            targetImg.src = e.target.result; 
            const guiPreview = document.getElementById(`gui-icon-preview-${targetId}`);
            if (guiPreview) {
                guiPreview.hidden = false;
                guiPreview.src = e.target.result;
            }
            
            if (targetId === 'img-lr') {
                targetImg.dataset.savedLrSrc = e.target.result;
            }

            const activeRarity = String(window.currentRarity || currentRarity || 'none').toUpperCase();
            // If uploading TUR icon and it's a TUR card, update the main top-left slot too
            if (targetId === 'img-tur' && activeRarity === 'TUR') {
                const mainTopLeftIcon = document.getElementById('img-lr');
                if (mainTopLeftIcon) mainTopLeftIcon.src = e.target.result;
            }

            // Immediately live sync to ABS composed icon
            const dbThumbImg = (window.getCardLayoutElement ? window.getCardLayoutElement('abs-thumb-img') : document.getElementById('abs-thumb-img'));
            if (dbThumbImg) {
                const isLR = activeRarity === 'LR';
                const lrThumb = document.getElementById('img-lr');
                const turThumb = document.getElementById('img-tur');
                const ssrThumb = document.getElementById('img-ssr');
                let thumbSrc = isLR ? (lrThumb ? lrThumb.src : '') : (activeRarity === 'TUR' ? (turThumb ? turThumb.src : '') : (ssrThumb ? ssrThumb.src : ''));
                dbThumbImg.src = thumbSrc || e.target.result;
            }

            if (window.updateRarityStats) window.updateRarityStats(activeRarity);
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

window.resetEditorCache = async function() {
    const confirmed = confirm("Are you sure you want to RESET the editor? All unsaved progress will be permanently lost!");
    if (!confirmed) return;

    window.IS_RESETTING = true;
    window.onbeforeunload = null;

    // Remove only the editor-owned save and theme preference. Other apps on
    // this origin may use localStorage/sessionStorage and must remain intact.
    try {
        await window.EditorAutosaveStore?.clear?.();
        window.localStorage.removeItem('dokkan_autosave');
        localStorage.removeItem('dokkan_selected_theme');
    } catch (e) {
        window.IS_RESETTING = false;
        console.error("Editor autosave clear error:", e);
        window.CardHubToast?.error('Reset could not clear the saved card', {
            detail: 'Your saved card was kept. Close other editor tabs and retry.',
            duration: 8000
        });
        return false;
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
    if (imgTur) {
        delete imgTur.dataset.absCleanCircleSrc;
        imgTur.src = "https://abscustom.github.io/assets/images/TUR_Icon.png";
    }
    if (imgSsr) {
        delete imgSsr.dataset.absCleanCircleSrc;
        imgSsr.src = "https://abscustom.github.io/assets/images/SSR_Icon.png";
    }
    if (mainRarity) mainRarity.src = "https://abscustom.github.io/assets/images/rarity_none.png";
    if (overlayImg) overlayImg.src = "https://abscustom.github.io/assets/images/Card Art Template.png";

    // 5. Reset Global Variables & Folder State
    window.currentType = "none";
    window.currentClass = "none";
    window.currentRarity = "none";
    window.currentAwakeningMode = "none";
    window.currentCardSource = "custom";
    window.currentOfficialCardId = "";
    window.currentOfficialCardAwakeningMode = "";
    window.autoDetectedFolderId = null;
    window.sIdx = 0;
    window.lIdx = 0;
    window.extractedCutins = [];
    window.scrapedAssets = {};

    // 6. Reload page with clean cache-busting URL
    setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '?reset=' + Date.now();
    }, 50);
    return true;
};

/**
 * Completely resets editor state in-memory without page reload or confirm prompts.
 * Used prior to importing cards (official or custom) to guarantee a pristine slate.
 */
window.clearEditorForCleanImport = function() {
    window.currentCardThumbnail = '';
    window.currentCustomCardAssetBaseUrl = '';
    window.currentCardSource = 'custom';
    window.currentOfficialCardId = '';
    window.currentOfficialCardAwakeningMode = '';
    window.setAbsUnitTag?.('');

    // The layouts contain duplicate presentation IDs. Clear art per root so
    // an import from one theme cannot leave stale layers in a hidden theme;
    // document.getElementById() only finds the first matching ID.
    const presentationRoots = ['dokkaninfo', 'abs-style', 'abs-clean']
        .map(theme => window.getCardLayoutRoot?.(theme))
        .filter(Boolean);
    presentationRoots.forEach(root => {
        const artBox = window.getCardLayoutElement?.('abs-art-layers-container', root);
        if (artBox) delete artBox.dataset.staticArtSrc;

        ['abs-art-bg', 'abs-art-char', 'abs-art-effect'].forEach(id => {
            const layer = window.getCardLayoutElement?.(id, root) ||
                root.querySelector(`[data-card-element="${id}"]`);
            if (!layer) return;
            layer.removeAttribute('src');
            layer.removeAttribute('data-failed');
            layer.removeAttribute('data-official-card-art');
            layer.style.display = 'none';
        });

        const artImage = root.dataset.cardLayout === 'dokkaninfo'
            ? root.querySelector('#myOverlayImage')
            : (window.getCardLayoutElement?.('abs-art-img', root) || root.querySelector('[data-card-element="abs-art-img"]'));
        if (artImage) {
            artImage.removeAttribute('src');
            artImage.removeAttribute('data-failed');
            artImage.removeAttribute('data-official-card-art');
            artImage.style.display = 'none';
        }

        const artVideo = root.dataset.cardLayout === 'dokkaninfo'
            ? root.querySelector('#myOverlayVideo')
            : window.getCardLayoutElement?.('abs-art-video', root);
        if (artVideo) {
            artVideo.pause();
            artVideo.removeAttribute('src');
            artVideo.removeAttribute('data-failed');
            artVideo.querySelector('source')?.removeAttribute('src');
            artVideo.style.display = 'none';
        }

        const bgCanvas = root.dataset.cardLayout === 'dokkaninfo'
            ? root.querySelector('#info-card-bg-lwf-canvas')
            : window.getCardLayoutElement?.('abs-card-bg-lwf-canvas', root);
        if (bgCanvas) {
            window.DokkanLWF?.destroy?.(bgCanvas.id);
            bgCanvas.classList.remove('lwf-active');
            bgCanvas.style.display = 'none';
            delete bgCanvas.dataset.lwfCardId;
            delete bgCanvas.dataset.lwfLoadedCardId;
            delete bgCanvas.dataset.lwfLoading;
            delete bgCanvas.dataset.lwfFailed;
        }
    });

    window.uploadedArtFile = null;
    window.uploadedArtType = null;
    window.uploadedArtImageFile = null;
    window.uploadedArtVideoFile = null;

    // 1. Clear editor-only skill source data. It lives outside presentation
    // roots so imports can never leave source blocks visible in Dokkan Info.
    window.clearEditorSkillSources?.();
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

    const sharedEditorContainers = new Set(['sidebar-sections-area']);
    elementsToClear.forEach(id => {
        if (sharedEditorContainers.has(id)) {
            const el = document.getElementById(id);
            if (el) el.replaceChildren();
            return;
        }
        presentationRoots.forEach(root => {
            const el = window.getCardLayoutElement?.(id, root) || null;
            if (el) el.replaceChildren();
        });
    });
    presentationRoots.forEach(root => {
        root.querySelectorAll('.info-rendered-skill').forEach(element => element.remove());
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

window.isPlaceholderCardArtUrl = function(value) {
    const source = String(value || '').trim();
    if (!source) return true;
    try {
        return /(?:^|\/)Card(?:%20| )Art(?:%20| )Template\.png(?:[?#]|$)/i.test(decodeURIComponent(source));
    } catch (e) {
        return /Card(?:%20| )Art(?:%20| )Template\.png/i.test(source);
    }
};

