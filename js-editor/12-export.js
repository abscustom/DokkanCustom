
/* ============================================================
   6. JSON EXPORT & RESTORE + GITHUB PUBLISHING & LIVE ADMIN SAVES
   ============================================================ */

/* Fullscreen Loading Overlay Engine */
window.showHudLoader = function(message) {
    const overlay = document.getElementById('glass-loading-overlay');
    const textEl = document.getElementById('glass-loading-text');
    const spinner = document.getElementById('glass-spinner-container');
    const success = document.getElementById('glass-success-container');

    if (overlay) {
        overlay.style.display = 'flex';
        overlay.style.zIndex = '9999999'; // Force above everything
    }
    
    if (spinner) spinner.style.display = 'flex';
    if (success) success.style.display = 'none';

    if (textEl && message) {
        textEl.textContent = message;
        textEl.style.color = "#38bdf8"; // Blue glow
        textEl.style.textShadow = "0 0 10px rgba(56,189,248,0.8)";
    }
};

window.showHudSuccess = function(message) {
    const overlay = document.getElementById('glass-loading-overlay');
    const textEl = document.getElementById('glass-loading-text');
    const spinner = document.getElementById('glass-spinner-container');
    const success = document.getElementById('glass-success-container');

    if (overlay) overlay.style.display = 'flex';
    
    if (spinner) spinner.style.display = 'none'; // Hide dots
    if (success) success.style.display = 'flex'; // Show SVG Checkmark

    if (textEl) {
        textEl.textContent = message || "SUCCESS!";
        textEl.style.color = "#10b981"; // Emerald green glow
        textEl.style.textShadow = "0 0 10px rgba(16,185,129,0.8)";
    }
    
    // Auto-hide the success overlay after 2.5 seconds to show off checkmark
    setTimeout(() => {
        window.hideHudLoader();
    }, 2500);
};

window.hideHudLoader = function() {
    const overlay = document.getElementById('glass-loading-overlay');
    if (overlay) overlay.style.display = 'none';
};

// ============================================================
// JSON EXPORT & IMPORT
// ============================================================

window.getProjectDataObject = function() {
    let inputData = {};
    savedInputs.forEach(id => { 
        const el = document.getElementById(id); 
        if (el) inputData[id] = el.value; 
    });

    document.querySelectorAll('#sidebar-sections-area input').forEach(input => input.setAttribute('value', input.value));
    document.querySelectorAll('#sidebar-sections-area textarea').forEach(ta => {
        ta.textContent = ta.value;
        ta.setAttribute('value', ta.value);
    });

    const saHTMLBlocks = Array.from(document.querySelectorAll(".sa-block")).map(b => b.outerHTML);
    const activeHTMLBlocks = Array.from(document.querySelectorAll(".active-block")).map(b => b.outerHTML);

    const formsData = [];
    document.querySelectorAll("#forms-container .dokkan-card").forEach((formEl) => {
        const img = formEl.querySelector('.form-image');
        const nameSpan = formEl.querySelector('.form-name-display');
        
        formsData.push({
            imageSrc: img?.src || "",
            imageExportName: img?.getAttribute('data-export-name') || "",
            name: nameSpan?.innerText || "",
            link: formEl.querySelector(".form-link")?.getAttribute("href") || "",
            hubLetter: formEl.getAttribute("data-hub-letter") || "a"
        });
    });

    return {
        currentType: currentType, 
        currentClass: currentClass,
        currentRarity: currentRarity,
        currentAwakeningMode: currentAwakeningMode,
        counters: { sIdx: sIdx, lIdx: lIdx }, 
        inputs: inputData,
        stats: {
            hpMax: parseInt(document.getElementById('input-hp-max')?.value || document.getElementById('stat-hp-max')?.textContent?.replace(/[^\d]/g, '') || 10000, 10),
            hpMin: parseInt(document.getElementById('input-hp-min')?.value || document.getElementById('stat-hp-min')?.textContent?.replace(/[^\d]/g, '') || 0, 10),
            atkMax: parseInt(document.getElementById('input-atk-max')?.value || document.getElementById('stat-atk-max')?.textContent?.replace(/[^\d]/g, '') || 10000, 10),
            atkMin: parseInt(document.getElementById('input-atk-min')?.value || document.getElementById('stat-atk-min')?.textContent?.replace(/[^\d]/g, '') || 0, 10),
            defMax: parseInt(document.getElementById('input-def-max')?.value || document.getElementById('stat-def-max')?.textContent?.replace(/[^\d]/g, '') || 5000, 10),
            defMin: parseInt(document.getElementById('input-def-min')?.value || document.getElementById('stat-def-min')?.textContent?.replace(/[^\d]/g, '') || 0, 10)
        },
        thumbSsr: document.getElementById('ssr-row')?.querySelector('#img-ssr')?.getAttribute('src') || document.getElementById('img-ssr')?.getAttribute('src') || "",
        thumbTur: document.getElementById('tur-row')?.querySelector('#img-tur')?.getAttribute('src') || document.getElementById('img-tur')?.getAttribute('src') || "",
        thumbLr: document.getElementById('img-lr')?.getAttribute('src') || "",
        thumbMain: document.getElementById('abs-thumb-img')?.getAttribute('src') || "",
        activeBlocksHTML: activeHTMLBlocks, 
        saBlocksHTML: saHTMLBlocks,         
        containers: {
            passiveCard: document.getElementById("card-passive-container")?.innerHTML || "",
            passiveSidebar: document.getElementById("sidebar-sections-area")?.innerHTML || "",
            links: document.getElementById("card-link-container")?.innerHTML || "",
            categories: document.getElementById("card-category-container")?.innerHTML || "",
            forms: document.getElementById("forms-container")?.innerHTML || ""
        },
        formsData: formsData,
        passiveName: document.getElementById('input-passive-name-sidebar')?.value || "",
        passiveHeaderIconsOverride: window.passiveHeaderIconsOverride || null,
        cardArtImage: document.getElementById("myOverlayImage")?.src || "",
        cardArtVideo: document.getElementById("myOverlayVideo")?.querySelector('source')?.src || ""
    };
};

window.exportProjectAsJson = function() {
    try {
        const projectData = window.getProjectDataObject();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
        const downloadNode = document.createElement('a');
        downloadNode.setAttribute("href", dataStr);
        downloadNode.setAttribute("download", "dokkan_project_" + (document.getElementById("nameInput")?.value || "unit") + ".json");
        document.body.appendChild(downloadNode); 
        downloadNode.click(); 
        downloadNode.remove();

        console.log("JSON export completed successfully");
    } catch (e) {
        console.error("JSON export failed:", e);
        alert("Failed to export JSON. Please check the console.");
    }
};

window.loadProjectData = function(projectData, baseUrl = '') {
    if (!projectData) return;
    const fixUrl = (src) => {
        if (!src) return "";
        const trimmed = String(src).trim();
        if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

        const cleanBase = (baseUrl || '').replace(/\/+$/, '') + '/';
        const cleanSrc = trimmed.replace(/^\.\//, '').replace(/^\//, '');

        const commonAssetNames = [
            'frame_agl.png', 'frame_teq.png', 'frame_int.png', 'frame_str.png', 'frame_phy.png', 'frame_none.png',
            'type_agl.png', 'type_teq.png', 'type_int.png', 'type_str.png', 'type_phy.png', 'type_none.png',
            'super_type_agl.png', 'super_type_teq.png', 'super_type_int.png', 'super_type_str.png', 'super_type_phy.png',
            'extreme_type_agl.png', 'extreme_type_teq.png', 'extreme_type_int.png', 'extreme_type_str.png', 'extreme_type_phy.png',
            'rarity_ssr.png', 'rarity_TUR.png', 'rarity_LR.png', 'rarity_none.png',
            'rarity_ssr_abs.png', 'rarity_TUR_abs.png', 'rarity_lr_abs.png',
            'eza_abs.png', 'superza_abs.png', 'eza_img.png', 'supereza_img.png',
            'z-awaken.png', 'dokkan-awaken.png', 'lr_spin_dial.png', 'lightningfx.webm',
            'SSR_Icon.png', 'TUR_Icon.png', 'LR_Icon.png', 'default.png', 'abs.custom.png', 'abs.style.png',
            'dokkan-info-logo.png'
        ];

        const fileName = cleanSrc.split('/').pop();
        if (commonAssetNames.includes(fileName)) {
            return `https://abscustom.github.io/assets/images/${fileName}`;
        }

        if (cleanBase) {
            return cleanBase + cleanSrc;
        }
        return trimmed;
    };

    currentType = projectData.currentType || "agl";
    currentClass = projectData.currentClass || "super";
    currentRarity = projectData.currentRarity || "LR";
    currentAwakeningMode = projectData.currentAwakeningMode || "none";

    window.updateRarityStats(currentRarity);

    if (projectData.counters) { 
        sIdx = projectData.counters.sIdx || 0; 
        lIdx = projectData.counters.lIdx || 0; 
    }

    if (projectData.containers) {
        const norm = (s) => {
            let str = window.normalizeAssetUrl ? window.normalizeAssetUrl(s) : s;
            if (baseUrl) {
                str = str.replace(/src="(images\/[^"]+)"/g, (m, p) => `src="${fixUrl(p)}"`);
                str = str.replace(/src="(\.\/images\/[^"]+)"/g, (m, p) => `src="${fixUrl(p)}"`);
            }
            return str;
        };

        if (document.getElementById("card-passive-container")) {
            document.getElementById("card-passive-container").innerHTML = norm(projectData.containers.passiveCard || "");
        }
        if (document.getElementById("sidebar-sections-area")) {
            document.getElementById("sidebar-sections-area").innerHTML = norm(projectData.containers.passiveSidebar || "");
        }
        if (document.getElementById("card-link-container")) {
            document.getElementById("card-link-container").innerHTML = norm(projectData.containers.links || "");
        }
        if (document.getElementById("card-category-container")) {
            document.getElementById("card-category-container").innerHTML = norm(projectData.containers.categories || "");
        }
        
        document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]').forEach(sec => {
            const id = sec.id.replace('side-sec-', '');
            const hInput = sec.querySelector('input[type="text"]');
            const ta = sec.querySelector('textarea');
            if (hInput) {
                const val = hInput.getAttribute('value') || hInput.value;
                hInput.value = val;
                if (window.updateHeader) window.updateHeader(id, val);
            }
            if (ta) {
                const val = ta.textContent || ta.getAttribute('value') || ta.value;
                ta.value = val;
                if (window.updateSection) window.updateSection(id, val);
            }
        });

        const formsContainer = document.getElementById("forms-container");
        if (formsContainer) {
            formsContainer.innerHTML = "";
            if (projectData.formsData && projectData.formsData.length > 0) {
                projectData.formsData.forEach(fData => {
                    window.addFormBlock(fData.name, fixUrl(norm(fData.imageSrc)), fData.imageExportName, fData.hubLetter || "a");
                    if (fData.link && selectedForm) {
                        const anchor = selectedForm.querySelector(".form-link");
                        if (anchor) anchor.href = fData.link;
                    }
                });
            } else if (projectData.containers && projectData.containers.forms) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = norm(projectData.containers.forms);
                const oldCards = tempDiv.querySelectorAll('.dokkan-card');
                
                oldCards.forEach(oldCard => {
                    const oldName = oldCard.querySelector('.form-name')?.innerText.trim() || "Old Form";
                    const oldImg = fixUrl(norm(oldCard.querySelector('.form-image')?.src || ""));
                    const oldExport = oldCard.querySelector('.form-image')?.getAttribute('data-export-name') || "";
                    const oldLink = oldCard.querySelector('.form-link')?.getAttribute('href') || "";
                    const oldLetter = oldCard.getAttribute('data-hub-letter') || "a";
                    
                    window.addFormBlock(oldName, oldImg, oldExport, oldLetter);
                    if (oldLink !== "" && oldLink !== "javascript:void(0)" && selectedForm) {
                        const anchor = selectedForm.querySelector(".form-link");
                        if (anchor) anchor.href = oldLink;
                    }
                });
            }
        }
    }

    document.querySelectorAll(".active-block, .sa-block").forEach(el => el.remove());
    const normBlock = (s) => {
        let str = window.normalizeAssetUrl ? window.normalizeAssetUrl(s) : s;
        if (baseUrl) {
            str = str.replace(/src="(images\/[^"]+)"/g, (m, p) => `src="${fixUrl(p)}"`);
            str = str.replace(/src="(\.\/images\/[^"]+)"/g, (m, p) => `src="${fixUrl(p)}"`);
        }
        return str;
    };
    
    if (projectData.activeBlocksHTML) {
        const actSpot = document.getElementById("active-skill-insert-spot");
        if (actSpot) projectData.activeBlocksHTML.forEach(html => actSpot.insertAdjacentHTML('beforebegin', normBlock(html)));
    }
    
    if (projectData.saBlocksHTML) {
        const saSpot = document.getElementById("sa-insert-spot");
        if (saSpot) projectData.saBlocksHTML.forEach(html => saSpot.insertAdjacentHTML('beforebegin', normBlock(html)));
    }

    if (projectData.inputs) {
        savedInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el && projectData.inputs[id] !== undefined) {
                el.value = projectData.inputs[id];
            }
        });
    }

    if (projectData.passiveName) {
        const passiveInput = document.getElementById('input-passive-name-sidebar');
        if (passiveInput) passiveInput.value = projectData.passiveName;
        const passiveDisplay = document.querySelector('.passive-name-display');
        if (passiveDisplay) passiveDisplay.innerText = projectData.passiveName;
    }

    if (projectData.passiveHeaderIconsOverride !== undefined) {
        window.passiveHeaderIconsOverride = projectData.passiveHeaderIconsOverride;
    }

    if (projectData.cardArtImage) {
        const artImg = document.getElementById("myOverlayImage");
        if (artImg) {
            artImg.src = fixUrl(projectData.cardArtImage);
            artImg.style.display = 'block';
        }
        const vidOverlay = document.getElementById("myOverlayVideo");
        if (vidOverlay) vidOverlay.style.display = 'none';
    }
    if (projectData.cardArtVideo) {
        const vidSource = document.getElementById("myOverlayVideo")?.querySelector('source');
        const vidOverlay = document.getElementById("myOverlayVideo");
        if (vidSource && vidOverlay) {
            vidSource.src = fixUrl(projectData.cardArtVideo);
            vidOverlay.style.display = 'block';
            vidOverlay.load();
            vidOverlay.play().catch(()=>{});
        }
        const artImg = document.getElementById("myOverlayImage");
        if (artImg) artImg.style.display = 'none';
    }

    if (projectData.thumbSsr) {
        document.querySelectorAll('#img-ssr').forEach(el => el.src = fixUrl(projectData.thumbSsr));
    }
    if (projectData.thumbTur) {
        document.querySelectorAll('#img-tur').forEach(el => el.src = fixUrl(projectData.thumbTur));
    }
    if (projectData.thumbLr) {
        const elLr = document.getElementById('img-lr');
        if (elLr) elLr.src = fixUrl(projectData.thumbLr);
    }
    if (projectData.thumbMain) {
        const elAbs = document.getElementById('abs-thumb-img');
        if (elAbs) elAbs.src = fixUrl(projectData.thumbMain);
    }

    if (projectData.stats) {
        const inpHp = document.getElementById('input-hp-max');
        const inpAtk = document.getElementById('input-atk-max');
        const inpDef = document.getElementById('input-def-max');
        const inpHpMin = document.getElementById('input-hp-min');
        const inpAtkMin = document.getElementById('input-atk-min');
        const inpDefMin = document.getElementById('input-def-min');

        if (inpHp && projectData.stats.hpMax) inpHp.value = projectData.stats.hpMax;
        if (inpAtk && projectData.stats.atkMax) inpAtk.value = projectData.stats.atkMax;
        if (inpDef && projectData.stats.defMax) inpDef.value = projectData.stats.defMax;
        if (inpHpMin && projectData.stats.hpMin) inpHpMin.value = projectData.stats.hpMin;
        if (inpAtkMin && projectData.stats.atkMin) inpAtkMin.value = projectData.stats.atkMin;
        if (inpDefMin && projectData.stats.defMin) inpDefMin.value = projectData.stats.defMin;

        if (window.calcFromMax) {
            window.calcFromMax('hp', projectData.stats.hpMin || Math.round(projectData.stats.hpMax / 3.3));
            window.calcFromMax('atk', projectData.stats.atkMin || Math.round(projectData.stats.atkMax / 3.3));
            window.calcFromMax('def', projectData.stats.defMin || Math.round(projectData.stats.defMax / 3.3));
        }
    }

    window.applyCardTheme(currentType); 
    window.applyAwakening(currentAwakeningMode);
    window.updateIdentity(); 
    window.calcFromMin('hp'); 
    window.calcFromMin('atk'); 
    window.calcFromMin('def');
    window.refreshSADropdown();
    window.refreshActiveDropdown(); 
    window.refreshFormList();
    
    if (typeof window.updateCardDisplay === 'function') {
        window.updateCardDisplay();
    } else if (window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
    if (window.updateAbsStyleSuperAttacks) {
        window.updateAbsStyleSuperAttacks();
    }
    if (window.refreshEditorLinkingPartners) {
        window.refreshEditorLinkingPartners();
    }
    if (window.autoSaveToCache) {
        window.autoSaveToCache();
    }
};

window.importProjectFromJson = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const projectData = JSON.parse(text);
            window.loadProjectData(projectData);
            console.log("JSON import completed successfully");
            alert("Project imported successfully!");
        } catch (e) {
            console.error("JSON import failed:", e);
            alert("Failed to import JSON. Please check the file format and console.");
        }
    };
    
    input.click();
};

// ============================================================
// IMAGE BLOB & ASSET PROCESSING (REQUIRED FOR GITHUB EXPORT)
// ============================================================

async function processCloneImagesForUpload(clone, basePath, filesToUpload, fileMap) {
    const cloneImgs = clone.querySelectorAll('img');
    for (let idx = 0; idx < cloneImgs.length; idx++) {
        const img = cloneImgs[idx];
        const exportName = img.getAttribute('data-export-name');
        const src = img.getAttribute('src') || '';

        if (src.startsWith('blob:') || src.startsWith('data:')) {
            const blob = await dataUrlToBlob(src);
            if (blob) {
                const ext = blob.type.includes('png') ? 'png' : (blob.type.includes('webp') ? 'webp' : 'jpg');
                const cleanFileName = exportName ? exportName.replace(/^images\//, '') : `img_export_${idx + 1}_${Date.now().toString(36)}.${ext}`;
                const relPath = `images/${cleanFileName}`;
                const fullPath = `${basePath}/${relPath}`;

                if (!fileMap.has(fullPath)) {
                    filesToUpload.push({ path: fullPath, blob });
                    fileMap.set(fullPath, true);
                }
                img.setAttribute('src', relPath);
            } else if (exportName) {
                img.setAttribute('src', exportName);
            }
        } else if (exportName) {
            img.setAttribute('src', exportName);
        }
    }

    const cloneForms = clone.querySelectorAll('[data-thumb-src]');
    for (let idx = 0; idx < cloneForms.length; idx++) {
        const formEl = cloneForms[idx];
        const thumbSrc = formEl.getAttribute('data-thumb-src') || '';

        if (thumbSrc.startsWith('blob:') || thumbSrc.startsWith('data:')) {
            const blob = await dataUrlToBlob(thumbSrc);
            if (blob) {
                const ext = blob.type.includes('png') ? 'png' : 'jpg';
                const relPath = `images/Form_Thumb_${idx + 1}_${Date.now().toString(36)}.${ext}`;
                const fullPath = `${basePath}/${relPath}`;

                if (!fileMap.has(fullPath)) {
                    filesToUpload.push({ path: fullPath, blob });
                    fileMap.set(fullPath, true);
                }
                formEl.setAttribute('data-thumb-src', relPath);
            }
        }
    }
}

// ============================================================
// UPLOAD MODAL & GITHUB API LIVE VALIDATION LOGIC
// ============================================================

let idCheckTimeout;
let isFolderAvailable = false;

// FULL CHARACTER NAME SLUGIFIER (e.g. "Super #17" -> "super-17")
function slugifyCharacterName(rawName) {
    if (!rawName) return "";
    let str = rawName.toLowerCase();
    
    // Convert & to 'and'
    str = str.replace(/&/g, 'and');
    
    // Replace non-alphanumeric chars with spaces
    str = str.replace(/[^a-z0-9\s-]/g, ' ');
    
    // Collapse spaces into hyphens
    str = str.trim().replace(/[\s-]+/g, '-');
    
    // Trim hyphens from edges
    str = str.replace(/^-+|-+$/g, '');
    
    // Cap at 30 chars
    if (str.length > 30) {
        str = str.substring(0, 30).replace(/-+$/, '');
    }
    
    return str;
}

window.openUploadModal = function() {
    let baseId = "";
    const urlInputVal = document.getElementById('asset-url-input')?.value || "";
    const urlMatch = urlInputVal.match(/cards\/(\d{7})/);

    if (urlMatch) {
        baseId = urlMatch[1];
    } else if (window.scrapedAssets) {
        const keys = Object.keys(window.scrapedAssets);
        for (let k of keys) {
            const m = k.match(/(\d{7})\.png/);
            if (m) { baseId = m[1]; break; }
        }
    }

    if (!baseId) {
        const imgVal = document.getElementById('imageInput')?.value || "";
        const m = imgVal.match(/(\d{7})/);
        if (m) baseId = m[1];
    }

    if (!baseId) {
        baseId = Math.floor(1000000 + Math.random() * 9000000).toString();
    }

    // Extract Full Name Slug
    const charNameRaw = document.getElementById("nameInput")?.value || "";
    const nameSlug = slugifyCharacterName(charNameRaw);

    const finalFolderId = nameSlug ? `${baseId}-${nameSlug}` : baseId;

    // Set Inputs
    const idInput = document.getElementById('upload-folder-id');
    const tokenInput = document.getElementById('upload-github-token');
    
    if (idInput) idInput.value = finalFolderId;
    if (tokenInput) {
        const savedToken = localStorage.getItem('gh_token') || "";
        tokenInput.value = savedToken;
    }

    document.getElementById('glass-upload-modal').style.display = 'flex';
    window.debounceIdCheck();
};

window.closeUploadModal = function() {
    document.getElementById('glass-upload-modal').style.display = 'none';
};

window.debounceIdCheck = function() {
    clearTimeout(idCheckTimeout);
    const idInput = document.getElementById('upload-folder-id');
    const statusIcon = document.getElementById('upload-id-status');
    const statusMsg = document.getElementById('upload-id-msg');
    const btn = document.getElementById('confirm-upload-btn');

    isFolderAvailable = false;
    btn.disabled = true;

    const val = idInput.value.trim().toLowerCase();

    // Valid slug check: Alphanumeric and hyphens, 3 to 50 chars
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(val) || val.length < 3 || val.length > 50) {
        statusIcon.innerHTML = `
            <svg class="status-icon-x" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>`;
        statusMsg.innerText = "ID must use letters, numbers, or hyphens (3-50 chars).";
        statusMsg.style.color = "#ef4444";
        return;
    }

    statusIcon.innerHTML = `
        <svg class="status-icon-spin" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>`;
    statusMsg.innerText = "Checking repository...";
    statusMsg.style.color = "#9ca3af";

    idCheckTimeout = setTimeout(() => {
        window.checkFolderAvailability(val);
    }, 500);
};

window.checkFolderAvailability = async function(id) {
    const statusIcon = document.getElementById('upload-id-status');
    const statusMsg = document.getElementById('upload-id-msg');

    try {
        const res = await fetch(`https://api.github.com/repos/abscustom/abscustom.github.io/contents/${id}`);
        
        if (res.status === 200) {
            statusIcon.innerHTML = `
                <svg class="status-icon-check" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`;
            statusMsg.innerText = "Existing card found — will overwrite & update on GitHub.";
            statusMsg.style.color = "#f59e0b";
            isFolderAvailable = true;
        } else if (res.status === 404) {
            statusIcon.innerHTML = `
                <svg class="status-icon-check" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`;
            statusMsg.innerText = "New card ID is available!";
            statusMsg.style.color = "#10b981";
            isFolderAvailable = true;
        } else {
            statusIcon.innerHTML = `⚠️`;
            statusMsg.innerText = "API rate limit reached. Proceed with GitHub token.";
            statusMsg.style.color = "#f59e0b";
            isFolderAvailable = true; 
        }
    } catch (e) {
        statusIcon.innerHTML = `⚠️`;
        statusMsg.innerText = "Network check bypassed. Ready for upload.";
        statusMsg.style.color = "#f59e0b";
        isFolderAvailable = true; 
    }
    
    window.checkUploadFormValidity();
};

window.checkUploadFormValidity = function() {
    const token = document.getElementById('upload-github-token')?.value.trim() || "";
    const btn = document.getElementById('confirm-upload-btn');
    if (!btn) return;
    if (isFolderAvailable && token.length > 15) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
};

window.executeGitHubUpload = async function() {
    const rawFolderId = document.getElementById('upload-folder-id').value.trim().toLowerCase();
    const githubToken = document.getElementById('upload-github-token').value.trim();
    const rememberBox = document.getElementById('upload-remember-token');
    
    if (!rawFolderId || !githubToken) return;

    // Sanitize folder path
    const folderId = rawFolderId.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    if (rememberBox && rememberBox.checked) {
        localStorage.setItem('gh_token', githubToken);
    } else {
        localStorage.removeItem('gh_token');
    }
    
    window.closeUploadModal();
    window.showHudLoader('Uploading Card...');

    let cleanHubId = "a";
    if (selectedForm && selectedForm.getAttribute('data-hub-letter')) {
        cleanHubId = selectedForm.getAttribute('data-hub-letter').trim().toLowerCase();
    } else {
        const firstFormWithLetter = document.querySelector("#forms-container .dokkan-card[data-hub-letter]");
        if (firstFormWithLetter) {
            cleanHubId = firstFormWithLetter.getAttribute('data-hub-letter').trim().toLowerCase();
        } else if (window.currentHubFormLetter) {
            cleanHubId = window.currentHubFormLetter.toLowerCase();
        }
    }

    try {
        const owner = "abscustom";
        const repo = "abscustom.github.io";
        const basePath = folderId;

        const userResponse = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        if (!userResponse.ok) throw new Error("Invalid GitHub token or authentication failed");

        savedInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName.toLowerCase() === 'textarea') el.textContent = el.value;
                el.setAttribute('value', el.value);
            }
        });

        window.updateIdentity();
        window.applyCardTheme(currentType);
        window.applyAwakening(currentAwakeningMode);
        window.calcFromMin('hp');
        window.calcFromMin('atk');
        window.calcFromMin('def');
        if (window.syncToAbsLayout) window.syncToAbsLayout();

        let clone = document.documentElement.cloneNode(true);

        // CLEAR THE LOADER FROM THE EXPORTED CLONE SO IT DOESN'T GET STUCK!
        const cloneOverlay = clone.querySelector('#glass-loading-overlay');
        if (cloneOverlay) cloneOverlay.style.display = 'none';

        const cloneQuickModal = clone.querySelector('#glass-quicksave-modal');
        if (cloneQuickModal) cloneQuickModal.style.display = 'none';

        const cloneAdminModal = clone.querySelector('#glass-admin-unlock-modal');
        if (cloneAdminModal) cloneAdminModal.style.display = 'none';

        const cloneQuickSave = clone.querySelector('#admin-quick-save-btn');
        if (cloneQuickSave) cloneQuickSave.style.display = "none";

        const cloneExportJson = clone.querySelector('#admin-export-json-btn');
        if (cloneExportJson) cloneExportJson.style.display = "none";

        const charTitleRaw = document.getElementById("descInput")?.value || document.getElementById("char-description")?.textContent || "";
        const charName = document.getElementById("nameInput")?.value || document.getElementById("char-name")?.textContent || "";
        const leaderSkill = document.getElementById("leaderInput")?.value || document.getElementById("leader-skill")?.textContent || "";
        const cleanTitle = charTitleRaw.replace(/[\[\]]/g, '').trim();
        const fullDisplayName = cleanTitle ? `[${cleanTitle}] ${charName}` : charName;

        if (clone.querySelector('title')) clone.querySelector('title').innerText = fullDisplayName;

        let pubScript = clone.querySelector('#pub-site-marker');
        if (!pubScript) {
            pubScript = document.createElement('script');
            pubScript.id = 'pub-site-marker';
            clone.querySelector('head').appendChild(pubScript);
        }
        pubScript.textContent = `
            window.IS_PUBLISHED = true; 
            window.PUBLISHED_SITE_FOLDER = "${basePath}";
            window.currentType = "${currentType}";
            window.currentClass = "${currentClass}";
            window.currentRarity = "${currentRarity}";
            window.currentAwakeningMode = "${currentAwakeningMode}";
            window.currentCardThemeStyle = "${window.currentCardThemeStyle || 'dokkaninfo'}";
            window.currentHubFormLetter = "${cleanHubId}";
        `;

        const cloneBody = clone.querySelector('body');
        if (cloneBody) {
            cloneBody.classList.add('is-published');
            cloneBody.classList.remove('admin-mode-active');
        }

        const hubMeta = clone.querySelector('meta[name="hub-id"]');
        if (hubMeta) {
            hubMeta.setAttribute('content', cleanHubId);
        } else {
            const newMeta = document.createElement('meta');
            newMeta.name = "hub-id";
            newMeta.content = cleanHubId;
            clone.querySelector('head').appendChild(newMeta);
        }

        const nameSelectors = ['meta[itemprop="name"]', 'meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="apple-mobile-web-app-title"]'];
        nameSelectors.forEach(sel => { const el = clone.querySelector(sel); if (el) el.setAttribute('content', fullDisplayName); });

        const descSelectors = ['meta[name="description"]', 'meta[itemprop="description"]', 'meta[property="og:description"]', 'meta[property="twitter:description"]'];
        descSelectors.forEach(sel => { const el = clone.querySelector(sel); if (el) el.setAttribute('content', leaderSkill); });

        if (window.uploadedArtFile) {
            const fileName = window.uploadedArtType === 'video' ? "card_art.mp4" : "card_art.png";
            if (window.uploadedArtType === 'video') {
                const videoSource = clone.querySelector('#myOverlayVideo source');
                const videoTag = clone.querySelector('#myOverlayVideo');
                if (videoSource) videoSource.setAttribute('src', fileName);
                if (videoTag) videoTag.setAttribute('src', fileName);
            } else {
                const imageTag = clone.querySelector('#myOverlayImage');
                if (imageTag) imageTag.setAttribute('src', fileName);
            }
        }

        const frameImg = clone.querySelector('.card-frame');
        if (frameImg) frameImg.src = `images/frame_${currentType}.png`;

        const rarityIcon = clone.querySelector('#main-rarity-icon');
        if (rarityIcon) rarityIcon.src = `images/rarity_${currentRarity}.png`;

        const typeIcon = clone.querySelector('.typing-icon');
        if (typeIcon) typeIcon.src = `images/${currentClass}_type_${currentType}.png`;

        const dbLayoutClone = clone.querySelector('#layout-abs-style');
        if (dbLayoutClone) {
            const themeColors = { 
                agl: { main: '#1d4ed8', border: '#3b82f6', header: '#1e40af', boxBg: '#0f172a', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)' }, 
                teq: { main: '#15803d', border: '#22c55e', header: '#166534', boxBg: '#052e16', text: '#4ade80', glow: 'rgba(74, 222, 128, 0.6)' }, 
                int: { main: '#7e22ce', border: '#a855f7', header: '#6b21a8', boxBg: '#2e1065', text: '#c084fc', glow: 'rgba(192, 132, 252, 0.6)' }, 
                str: { main: '#b91c1c', border: '#ef4444', header: '#991b1b', boxBg: '#450a0a', text: '#f87171', glow: 'rgba(248, 113, 113, 0.6)' }, 
                phy: { main: '#ca8a04', border: '#eab308', header: '#a16207', boxBg: '#342103', text: '#fde047', glow: 'rgba(234, 179, 8, 0.65)' }, 
                none: { main: '#3f3f46', border: '#71717a', header: '#27272a', boxBg: '#18181b', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.6)' } 
            };
            const colors = themeColors[currentType] || themeColors.none;
            dbLayoutClone.style.setProperty('--theme-main', colors.main);
            dbLayoutClone.style.setProperty('--theme-border', colors.border);
            dbLayoutClone.style.setProperty('--theme-header', colors.header);
            dbLayoutClone.style.setProperty('--theme-box-bg', colors.boxBg);
            dbLayoutClone.style.setProperty('--theme-text', colors.text);
            dbLayoutClone.style.setProperty('--theme-glow', colors.glow);
        }

        const toRemove = [
            '#uploadGithubBtn', '#topbar-upload-dock-wrap', '#icon-picker-modal', 
            '#glass-upload-modal', '#card-admin-modal', '#topbar-card-admin-dock-wrap',
            '#main-autosave-indicator', '#hud-loading-spinner', '#editor', 
            '#toggleBtn', '#topbar-theme-switcher', '.scouter-menu-btn'
        ];
        toRemove.forEach(sel => { clone.querySelectorAll(sel).forEach(el => el.remove()); });

        clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.removeAttribute('contenteditable'));

        const filesToUpload = [];
        const fileMap = new Map();

        const pagesWorkflowPath = ".github/workflows/pages.yml";
        const pagesWorkflowContent = `name: Deploy GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
        filesToUpload.push({ path: pagesWorkflowPath, blob: new Blob([pagesWorkflowContent], { type: 'text/plain' }) });
        fileMap.set(pagesWorkflowPath, true);

        Object.entries(window.scrapedAssets || {}).forEach(([fileName, blob]) => {
            const path = `${basePath}/images/${fileName}`;
            if (!fileMap.has(path)) {
                filesToUpload.push({ path, blob });
                fileMap.set(path, true);
            }
        });

        await processCloneImagesForUpload(clone, basePath, filesToUpload, fileMap);

        await processCloneImagesForUpload(clone, basePath, filesToUpload, fileMap);

        if (window.uploadedArtFile) {
            const fileName = window.uploadedArtType === 'video' ? "card_art.mp4" : "card_art.png";
            const path = `${basePath}/${fileName}`;
            if (!fileMap.has(path)) {
                filesToUpload.push({ path, blob: window.uploadedArtFile });
                fileMap.set(path, true);
            }
        }

        // Structured JSON metadata for high-speed Hub and Calculator loading
        const projectData = (typeof window.getProjectDataObject === 'function') ? window.getProjectDataObject() : null;
        if (projectData) {
            filesToUpload.push({
                path: `${basePath}/card.json`,
                blob: new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
            });
        }

        let htmlContent = "<!DOCTYPE html>\n" + clone.outerHTML;
        filesToUpload.push({
            path: `${basePath}/index.html`,
            blob: new Blob([htmlContent], { type: 'text/html' })
        });

        await uploadBatchToGitHub(
            githubToken, owner, repo, filesToUpload, `Add/Update: ${fullDisplayName}`
        );

        const websiteUrl = `https://abscustom.github.io/${basePath}/`;
        
        // SHOW ANIMATED GREEN CHECKMARK FOR UPLOAD SUCCESS
        window.showHudSuccess('UPLOAD COMPLETE!');

        setTimeout(() => {
            alert(`✅ Card Uploaded Successfully!\n\nWebsite: ${websiteUrl}\nForm Letter: ${cleanHubId.toUpperCase()}\n\nTip for Live Edits:\nOn your published page, press Ctrl+Shift+A to unlock Admin Mode anytime!`);
        }, 200);

    } catch (error) {
        window.hideHudLoader();
        console.error("Upload Error:", error);
        alert(`Failed: ${error.message}`);
    }
};

// ============================================================
// QUICK SAVE (ADMIN LIVE EDIT) MODAL & LOGIC
// ============================================================

window.openQuickSaveModal = function() {
    const tokenInput = document.getElementById('quicksave-github-token');
    if (tokenInput) {
        const savedToken = localStorage.getItem('gh_token') || "";
        tokenInput.value = savedToken;
    }
    document.getElementById('confirm-quicksave-btn').disabled = true;
    document.getElementById('glass-quicksave-modal').style.display = 'flex';
    window.checkQuickSaveValidity(); 
};

window.closeQuickSaveModal = function() {
    document.getElementById('glass-quicksave-modal').style.display = 'none';
};

window.checkQuickSaveValidity = function() {
    const token = document.getElementById('quicksave-github-token').value.trim();
    const btn = document.getElementById('confirm-quicksave-btn');
    if (token.length > 15) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
};

window.saveQuickEditToGitHub = function() {
    window.openQuickSaveModal();
};

window.executeQuickSave = async function() {
    const token = document.getElementById('quicksave-github-token').value.trim();
    const rememberBox = document.getElementById('quicksave-remember-token');
    
    if (!token) return;

    if (rememberBox && rememberBox.checked) {
        localStorage.setItem('gh_token', token);
    } else {
        localStorage.removeItem('gh_token');
    }
    
    window.closeQuickSaveModal();
    window.showHudLoader('Saving Quick Edit...');

    try {
        const owner = "abscustom";
        const repo = "abscustom.github.io";
        const folderName = window.PUBLISHED_SITE_FOLDER || window.location.pathname.split('/')[1] || "card";

        savedInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.tagName.toLowerCase() === 'textarea') el.textContent = el.value;
                el.setAttribute('value', el.value);
            }
        });

        window.updateIdentity();
        window.calcFromMin('hp');
        window.calcFromMin('atk');
        window.calcFromMin('def');
        if (window.syncToAbsLayout) window.syncToAbsLayout();

        let clone = document.documentElement.cloneNode(true);

        // CLEAR THE LOADER FROM THE EXPORTED CLONE SO IT DOESN'T GET STUCK!
        const cloneOverlay = clone.querySelector('#glass-loading-overlay');
        if (cloneOverlay) cloneOverlay.style.display = 'none';

        const cloneQuickModal = clone.querySelector('#glass-quicksave-modal');
        if (cloneQuickModal) cloneQuickModal.style.display = 'none';

        const cloneAdminModal = clone.querySelector('#glass-admin-unlock-modal');
        if (cloneAdminModal) cloneAdminModal.style.display = 'none';

        const cloneQuickSave = clone.querySelector('#admin-quick-save-btn');
        if (cloneQuickSave) cloneQuickSave.style.display = "none";

        const cloneExportJson = clone.querySelector('#admin-export-json-btn');
        if (cloneExportJson) cloneExportJson.style.display = "none";

        const filesToUpload = [];
        const fileMap = new Map();

        await processCloneImagesForUpload(clone, folderName, filesToUpload, fileMap);

        const currentLetter = window.currentHubFormLetter || clone.querySelector('meta[name="hub-id"]')?.getAttribute('content') || "a";

        let pubScript = clone.querySelector('#pub-site-marker');
        if (!pubScript) {
            pubScript = document.createElement('script');
            pubScript.id = 'pub-site-marker';
            clone.querySelector('head').appendChild(pubScript);
        }
        pubScript.textContent = `
            window.IS_PUBLISHED = true; 
            window.PUBLISHED_SITE_FOLDER = "${folderName}";
            window.currentType = "${currentType}";
            window.currentClass = "${currentClass}";
            window.currentRarity = "${currentRarity}";
            window.currentAwakeningMode = "${currentAwakeningMode}";
            window.currentCardThemeStyle = "${window.currentCardThemeStyle || 'dokkaninfo'}";
            window.currentHubFormLetter = "${currentLetter}";
        `;

        const cloneBody = clone.querySelector('body');
        if (cloneBody) {
            cloneBody.classList.add('is-published');
            cloneBody.classList.remove('admin-mode-active');
        }

        const toRemove = [
            '#uploadGithubBtn', '#topbar-upload-dock-wrap', '#icon-picker-modal', 
            '#glass-upload-modal', 
            '#main-autosave-indicator', '#hud-loading-spinner', '#editor', 
            '#toggleBtn', '#topbar-theme-switcher', '.scouter-menu-btn'
        ];
        toRemove.forEach(sel => { clone.querySelectorAll(sel).forEach(el => el.remove()); });

        const projectData = (typeof window.getProjectDataObject === 'function') ? window.getProjectDataObject() : null;
        if (projectData) {
            filesToUpload.push({
                path: `${folderName}/card.json`,
                blob: new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
            });
        }

        const htmlContent = "<!DOCTYPE html>\n" + clone.outerHTML;
        filesToUpload.push({ path: `${folderName}/index.html`, blob: new Blob([htmlContent], { type: 'text/html' }) });

        await uploadBatchToGitHub(token, owner, repo, filesToUpload, `Live Quick Edit Update`);

        window.showHudSuccess('SAVED LIVE!');
        setTimeout(() => { alert("✅ Quick edit saved live to GitHub Pages!"); }, 150);

    } catch (e) {
        window.hideHudLoader();
        console.error("Quick Edit Save Failed:", e);
        alert("Failed to save quick edit: " + e.message);
    }
};

