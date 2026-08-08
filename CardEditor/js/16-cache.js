

window.IS_RESETTING = false;

async function blobUrlToDataUrl(url) {
    if (!url) return "";
    if (url.startsWith('data:') || url.startsWith('http')) {
        return url;
    }
    if (url.startsWith('blob:')) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve("");
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn("Could not convert blob URL:", url);
            return "";
        }
    }
    return url;
}

window.autoSaveToCache = async function() {
    if (window.IS_RESETTING) return;

    try {
        let inputData = {};
        if (typeof savedInputs !== 'undefined') {
            savedInputs.forEach(id => { 
                const el = document.getElementById(id); 
                if (el) inputData[id] = el.value; 
            });
        }

        const saHTMLBlocks = Array.from(document.querySelectorAll(".sa-block")).map(b => b.outerHTML);
        const activeHTMLBlocks = Array.from(document.querySelectorAll(".active-block")).map(b => b.outerHTML);

        document.querySelectorAll('#sidebar-sections-area input').forEach(input => input.setAttribute('value', input.value));
        document.querySelectorAll('#sidebar-sections-area textarea').forEach(ta => ta.textContent = ta.value);

        const formsData = [];
        const formElements = document.querySelectorAll("#forms-container .dokkan-card");
        for (let formEl of Array.from(formElements)) {
            const img = formEl.querySelector('.form-image');
            const nameSpan = formEl.querySelector('.form-name-display');
            const thumbSrc = formEl.getAttribute('data-thumb-src') || "";
            
            formsData.push({
                imageSrc: img?.src ? await blobUrlToDataUrl(img.src) : "",
                imageExportName: img?.getAttribute('data-export-name') || "",
                name: nameSpan?.innerText || "",
                thumbSrc: thumbSrc ? await blobUrlToDataUrl(thumbSrc) : ""
            });
        }

        const passiveName = document.getElementById('input-passive-name-sidebar')?.value || "";
        const cardArtImage = document.getElementById("myOverlayImage");
        const cardArtImageSrc = cardArtImage?.src ? await blobUrlToDataUrl(cardArtImage.src) : "";
        const cardArtVideo = document.getElementById("myOverlayVideo")?.querySelector('source')?.src || "";

        const lrEl = document.getElementById("img-lr");
        const turEl = document.getElementById("img-tur");
        const ssrEl = document.getElementById("img-ssr");
        const mainRarityEl = document.getElementById("main-rarity-icon");

        const lrIconSrc = lrEl?.src ? await blobUrlToDataUrl(lrEl.src) : "";
        const turIconSrc = turEl?.src ? await blobUrlToDataUrl(turEl.src) : "";
        const ssrIconSrc = ssrEl?.src ? await blobUrlToDataUrl(ssrEl.src) : "";
        const mainRarityIconSrc = mainRarityEl?.src ? await blobUrlToDataUrl(mainRarityEl.src) : "";

        const projectData = {
            currentType: typeof currentType !== 'undefined' ? currentType : "agl", 
            currentClass: typeof currentClass !== 'undefined' ? currentClass : "super",
            currentRarity: typeof currentRarity !== 'undefined' ? currentRarity : "LR",
            currentAwakeningMode: typeof currentAwakeningMode !== 'undefined' ? currentAwakeningMode : "none",
            counters: { sIdx: typeof sIdx !== 'undefined' ? sIdx : 0, lIdx: typeof lIdx !== 'undefined' ? lIdx : 0 }, 
            inputs: inputData,
            activeBlocksHTML: activeHTMLBlocks, 
            saBlocksHTML: saHTMLBlocks,         
            containers: {
                passiveCard: document.getElementById("card-passive-container")?.innerHTML || "",
                passiveSidebar: document.getElementById("sidebar-sections-area")?.innerHTML || "",
                links: document.getElementById("card-link-container")?.innerHTML || "",
                categories: document.getElementById("card-category-container")?.innerHTML || "",
                forms: document.getElementById("forms-container")?.innerHTML || ""
            },
            icons: {
                lrIcon: lrIconSrc,
                turIcon: turIconSrc,
                ssrIcon: ssrIconSrc,
                mainRarityIcon: mainRarityIconSrc
            },
            formsData: formsData,
            passiveName: passiveName,
            cardArtImage: cardArtImageSrc,
            cardArtVideo: cardArtVideo,
            themeStyle: window.currentCardThemeStyle
        };

        if (!window.IS_RESETTING) {
            localStorage.setItem('dokkan_autosave', JSON.stringify(projectData));

            const mainIndicator = document.getElementById('main-autosave-indicator');
            if (mainIndicator) {
                mainIndicator.classList.add('show');
                setTimeout(() => { mainIndicator.classList.remove('show'); }, 2000);
            }
        }
    } catch (e) { 
        console.warn("Autosave Failed:", e); 
    }
};

window.loadFromCache = function() {
    if (window.location.search.includes('reset=')) {
        try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
        return;
    }

    try {
        const cacheData = localStorage.getItem('dokkan_autosave');
        if (!cacheData) return; 

        const data = JSON.parse(cacheData);

        currentType = data.currentType || "agl"; 
        currentClass = data.currentClass || "super";
        currentRarity = data.currentRarity || "LR";
        currentAwakeningMode = data.currentAwakeningMode || "none";

        window.updateRarityStats(currentRarity); 

        if(data.counters) { sIdx = data.counters.sIdx; lIdx = data.counters.lIdx; }

        if (data.containers) {
            if (data.containers.passiveCard) document.getElementById("card-passive-container").innerHTML = data.containers.passiveCard;
            if (data.containers.passiveSidebar) document.getElementById("sidebar-sections-area").innerHTML = data.containers.passiveSidebar;
            if (data.containers.links) document.getElementById("card-link-container").innerHTML = data.containers.links;
            if (data.containers.categories) document.getElementById("card-category-container").innerHTML = data.containers.categories;
            if (data.containers.forms) document.getElementById("forms-container").innerHTML = data.containers.forms;
        }

        document.querySelectorAll(".active-block, .sa-block").forEach(el => el.remove()); 

        if (data.activeBlocksHTML) {
            const actSpot = document.getElementById("active-skill-insert-spot");
            if (actSpot) data.activeBlocksHTML.forEach(html => actSpot.insertAdjacentHTML('beforebegin', html));
        }

        if (data.saBlocksHTML) {
            const saSpot = document.getElementById("sa-insert-spot");
            if (saSpot) data.saBlocksHTML.forEach(html => saSpot.insertAdjacentHTML('beforebegin', html));
        }

        window.applyCardTheme(currentType); 
        window.applyAwakening(currentAwakeningMode);

        if (data.inputs) {
            savedInputs.forEach(id => {
                const el = document.getElementById(id);
                if (el && data.inputs[id] !== undefined) { el.value = data.inputs[id]; }
            });
        }

        if (data.icons) {
            if(data.icons.lrIcon && document.getElementById("img-lr")) document.getElementById("img-lr").src = data.icons.lrIcon;
            if(data.icons.turIcon && document.getElementById("img-tur")) document.getElementById("img-tur").src = data.icons.turIcon;
            if(data.icons.ssrIcon && document.getElementById("img-ssr")) document.getElementById("img-ssr").src = data.icons.ssrIcon;
            if(data.icons.mainRarityIcon && document.getElementById("main-rarity-icon")) document.getElementById("main-rarity-icon").src = data.icons.mainRarityIcon;
        }

        if (data.cardArtImage) {
            const artImg = document.getElementById("myOverlayImage");
            if (artImg) artImg.src = data.cardArtImage;
        }
        if (data.cardArtVideo) {
            const vidSource = document.getElementById("myOverlayVideo")?.querySelector('source');
            if (vidSource) vidSource.src = data.cardArtVideo;
        }

        if (data.formsData) {
            const formElements = document.querySelectorAll("#forms-container .dokkan-card");
            window.extractedCutins = [];
            
            formElements.forEach((formEl, idx) => {
                if (data.formsData[idx]) {
                    const img = formEl.querySelector('.form-image');
                    if (img && data.formsData[idx].imageSrc) {
                        img.src = data.formsData[idx].imageSrc;
                        if (data.formsData[idx].imageExportName) { img.setAttribute('data-export-name', data.formsData[idx].imageExportName); }
                    }
                    if (data.formsData[idx].thumbSrc) {
                        formEl.setAttribute('data-thumb-src', data.formsData[idx].thumbSrc);
                    }
                    const nameSpan = formEl.querySelector('.form-name-display');
                    if (nameSpan && data.formsData[idx].name) {
                        nameSpan.innerText = data.formsData[idx].name;
                        nameSpan.style.fontWeight = "normal";
                    }
                }
            });
        }

        if (data.passiveName) {
            const passiveInput = document.getElementById('input-passive-name-sidebar');
            if (passiveInput) passiveInput.value = data.passiveName;
            
            const passiveDisplay = document.querySelector('.passive-name-display');
            if (passiveDisplay) passiveDisplay.innerText = data.passiveName;
        }

        // BULLETPROOF THEME LOADER
        if (data.themeStyle === 'abs-style') {
            window.toggleCardTheme(true);
        } else {
            window.toggleCardTheme(false);
        }

        window.updateIdentity(); 
        window.calcFromMin('hp'); 
        window.calcFromMin('atk'); 
        window.calcFromMin('def');

        window.refreshSADropdown();
        window.refreshActiveDropdown(); 

        if (document.querySelectorAll('.sa-block').length > 0) {
            const sel = document.getElementById('sa-selector');
            if (sel) sel.value = "0";
            if (window.handleSASelection) window.handleSASelection();
        }

        window.refreshFormList();
        window.updateCardDisplay(); 

    } catch (err) {
        console.error("Cache restoration failed:", err);
    }
};

