/* ============================================================
   7. EVENT BINDINGS AND DOM CONTENT LOADED
   ============================================================ */


/* ======================================================================= */
/* AUTO-HIDING SCROLLBAR ENGINE (ACTIVE ONLY WHILE SCROLLING)             */
/* ======================================================================= */
(function setupAutoHidingScrollbars() {
    let scrollTimer = null;

    const handleScrollActivity = (e) => {
        const target = (e && e.target && e.target.nodeType === 1) ? e.target : document.body;
        
        document.body.classList.add('is-scrolling');
        if (target) target.classList.add('is-scrolling');

        clearTimeout(scrollTimer);

        // Fades scrollbar out 1.2 seconds after scrolling stops
        scrollTimer = setTimeout(() => {
            document.body.classList.remove('is-scrolling');
            document.querySelectorAll('.is-scrolling').forEach(el => {
                el.classList.remove('is-scrolling');
            });
        }, 1200);
    };

    // Trigger ONLY on actual scroll/wheel/touchmove events (NOT mousemove)
    window.addEventListener('scroll', handleScrollActivity, { capture: true, passive: true });
    window.addEventListener('wheel', handleScrollActivity, { capture: true, passive: true });
    window.addEventListener('touchmove', handleScrollActivity, { capture: true, passive: true });
})();

document.addEventListener("DOMContentLoaded", function() {
    
    // Clean up cache-busting query parameter if coming from a reset
    if (window.location.search.includes('reset=')) {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch(e) {}
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // PUBLISHED SITE ADMIN MODE & INITIALIZATION CHECK
    if (window.IS_PUBLISHED) {
        window.ensurePublishedCustomCardRuntime?.();

        const sidebar = document.getElementById('editor');
        const toggleBtn = document.getElementById('toggleBtn');
        const scouterMenuBtn = document.querySelector('.scouter-menu-btn');
        if (sidebar) sidebar.style.display = 'none';
        if (toggleBtn) toggleBtn.style.display = 'none';
        if (scouterMenuBtn) scouterMenuBtn.style.display = 'none';

        // Restore active theme state and sync card parameters
        if (window.currentType) currentType = window.currentType;
        if (window.currentClass) currentClass = window.currentClass;
        if (window.currentRarity) currentRarity = window.currentRarity;
        if (window.currentAwakeningMode) currentAwakeningMode = window.currentAwakeningMode;

        window.applyCardTheme(currentType);
        window.updateRarityStats(currentRarity);
        window.applyAwakening(currentAwakeningMode);
        window.updateIdentity();

        window.calcFromMin('hp');
        window.calcFromMin('atk');
        window.calcFromMin('def');

        if (window.restoreThemeOnLoad) {
            window.restoreThemeOnLoad();
        } else if (window.currentCardThemeStyle) {
            window.toggleCardTheme(window.currentCardThemeStyle === 'abs-style');
        }

        setTimeout(() => {
            if (window.syncToAbsLayout) window.syncToAbsLayout();
            if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
            window.refreshEditorLinkingPartners?.();
        }, 200);

        console.log("Card loaded in Published View. Press Ctrl+Shift+A to unlock Admin Mode.");
    }

    const idsToUpdateIdentity = ["nameInput", "descInput", "dateInput", "leaderInput"];
    idsToUpdateIdentity.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.addEventListener("input", window.updateIdentity);
    });

    const activeSkillInputs = ["input-active-name", "input-active-effect", "input-active-condition-title", "input-active-conditions"];
    activeSkillInputs.forEach(id => {
        const element = document.getElementById(id);
        if(element) element.addEventListener("input", window.updateActiveCard);
    });

    const saInputs = ["input-sa-name", "input-sa-type-label", "input-sa-effects"];
    saInputs.forEach(id => {
        const element = document.getElementById(id);
        if(element) element.addEventListener("input", window.syncSuperAttack);
    });

    document.querySelectorAll('input[name="sa-icon"]').forEach(radio => {
        radio.addEventListener('change', window.syncSuperAttack);
    });

    const btnToggleSA = document.getElementById("btn-toggle-activation");
    if (btnToggleSA) {
        btnToggleSA.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (!currentSuperAttack) return;
            const actRow = currentSuperAttack.querySelector('.activation-row');
            const saLvArea = currentSuperAttack.querySelector('.sa-lv-container');
            const sidebarContainer = document.getElementById('activation-sidebar-container');
            const saActInput = document.getElementById('input-activation');

            if (actRow && saLvArea) {
                if (actRow.classList.contains('d-none')) {
                    actRow.classList.remove('d-none'); saLvArea.classList.add('d-none');
                    if (sidebarContainer) sidebarContainer.style.display = 'block';

                    const actTextDisp = currentSuperAttack.querySelector('.activation-text');
                    if (actTextDisp) {
                        const cleanText = (typeof window.extractCleanConditionText === 'function')
                            ? window.extractCleanConditionText(actTextDisp)
                            : actTextDisp.innerText.replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
                        if (saActInput) saActInput.value = cleanText;
                        if (cleanText === '') {
                            actTextDisp.innerHTML = `<strong>Activation Condition</strong>`;
                        }
                    }
                } else {
                    actRow.classList.add('d-none'); saLvArea.classList.remove('d-none');
                    if (sidebarContainer) sidebarContainer.style.display = 'none';
                }
            }
        });
    }

    const saActInput = document.getElementById('input-activation');
    if (saActInput) {
        saActInput.addEventListener('input', function() {
            if (!currentSuperAttack) return;
            const actTextDisp = currentSuperAttack.querySelector('.activation-text');
            if (actTextDisp) {
                const cleanVal = (typeof window.extractCleanConditionText === 'function')
                    ? window.extractCleanConditionText(this.value)
                    : this.value.trim().replace(/^activation\s+conditions?(\(s\))?[\s:]*/i, '').trim();
                if (cleanVal === "") {
                    actTextDisp.innerHTML = `<strong>Activation Condition</strong>`;
                } else {
                    actTextDisp.innerHTML = `<strong>Activation Condition</strong><br>${cleanVal.replace(/\n/g, '<br>')}`;
                }
            }
            if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
            if (window.syncToAbsLayout) window.syncToAbsLayout();
        });
    }

    const btnAddActive = document.getElementById("btn-add-active");
    if(btnAddActive) btnAddActive.addEventListener("click", window.addActiveSkillSection);

    const btnRemActive = document.getElementById("btn-remove-active");
    if(btnRemActive) {
        btnRemActive.addEventListener("click", function() {
            if (confirm("Remove this Skill Box?")) window.removeActiveSkillSection();
        });
    }

    const activeSelector = document.getElementById("active-selector");
    if(activeSelector) activeSelector.addEventListener("change", window.handleActiveSelection);

    const btnToggleActiveDiv = document.getElementById("btn-toggle-active-divider");
    if (btnToggleActiveDiv) {
        btnToggleActiveDiv.addEventListener('click', (e) => {
            e.preventDefault(); 
            if (!currentActiveSkill) return;
            const divRow = currentActiveSkill.querySelector('.active-divider-row');
            const condRow = currentActiveSkill.querySelector('.active-condition-row');
            const sidebarCondField = document.getElementById('active-sidebar-conditions-field');
            if (divRow) divRow.classList.toggle('d-none');
            if (condRow) condRow.classList.toggle('d-none');
            if (sidebarCondField && condRow) {
                sidebarCondField.style.display = condRow.classList.contains('d-none') ? 'none' : 'block';
            }
        });
    }

    const btnAddSa = document.getElementById("btn-add-sa");
    if(btnAddSa) btnAddSa.addEventListener("click", window.addSuperAttackSection);

    const btnRemoveSa = document.getElementById("btn-remove-sa");
    if(btnRemoveSa) {
        btnRemoveSa.addEventListener("click", function() {
            if (confirm("Are you sure you want to remove the entire Super Attack section?")) {
                window.removeSuperAttackSection();
            }
        });
    }

    const saSelector = document.getElementById("sa-selector");
    if(saSelector) saSelector.addEventListener("change", window.handleSASelection);

    const statAdd = document.getElementById("addStatBtn");
    if (statAdd) statAdd.addEventListener("click", () => {
        if(!currentSuperAttack) return;
        const cont = currentSuperAttack.querySelector('.stats-container');
        if(!cont) return;
        cont.insertAdjacentHTML('beforeend', `<div class="col sa-stat-row"><img class="display-img" width="50" src="https://abscustom.github.io/assets/images/st_0002.png"><span class="display-text ms-1">100%</span></div>`);
        window.refreshStatSidebar();
    });

    const statRem = document.getElementById("removeStatBtn");
    if (statRem) statRem.addEventListener("click", () => {
        if(!currentSuperAttack) return;
        const cont = currentSuperAttack.querySelector('.stats-container');
        if(cont && cont.lastElementChild) {
            cont.lastElementChild.remove();
            window.refreshStatSidebar();
        }
    });

    const statValInput = document.getElementById("statValueInput");
    if (statValInput) {
        statValInput.addEventListener("input", function() {
            if(!selectedStat || !selectedListItem) return;
            const valWithPercent = this.value + "%";
            selectedStat.querySelector(".display-text").textContent = valWithPercent;
            selectedListItem.querySelector(".form-list-name").textContent = valWithPercent;
            if (window.currentCardThemeStyle === 'abs-style') {
                window.syncToAbsLayout();
            }
        });
    }

    document.querySelectorAll(".sa-icon-option").forEach(icon => {
        icon.addEventListener("click", function() {
            if(!selectedStat) return;
            selectedStat.querySelector(".display-img").src = this.src;
            document.querySelectorAll(".sa-icon-option").forEach(i => i.classList.remove("selected-icon-highlight"));
            this.classList.add("selected-icon-highlight");
        });
    });

    document.querySelectorAll(".rarity-btn").forEach(btn => {
        btn.addEventListener("click", function() { 
            const rAlt = this.querySelector('img').alt.trim().toUpperCase();
            const rarity = rAlt.includes("LR") ? "LR" : "TUR";
            currentRarity = rarity;
            window.updateRarityStats(rarity); 
            
            setTimeout(() => {
                window.calcFromMin('hp');
                window.calcFromMin('atk');
                window.calcFromMin('def');
            }, 10);
        });
    });

    document.querySelectorAll(".class-btn").forEach(btn => {
        btn.addEventListener("click", function() { 
            currentClass = this.dataset.class; 
            window.updateIconImages(); 
        });
    });

    document.querySelectorAll(".type-btn").forEach(btn => {
        btn.addEventListener("click", function() { 
            window.applyCardTheme(this.dataset.suffix); 
        });
    });

    const toggleBtn = document.getElementById('toggleBtn');
    const editor = document.getElementById('editor');
    if (toggleBtn && editor) {
        let hoverTimeout = null;

        const openEditor = () => {
            clearTimeout(hoverTimeout);
            editor.classList.add('open');
        };

        const closeEditor = () => {
            hoverTimeout = setTimeout(() => {
                if (!editor.matches(':hover') && !toggleBtn.matches(':hover')) {
                    editor.classList.remove('open');
                }
            }, 300);
        };

        toggleBtn.addEventListener('mouseenter', openEditor);
        toggleBtn.addEventListener('mouseleave', closeEditor);

        editor.addEventListener('mouseenter', openEditor);
        editor.addEventListener('mouseleave', closeEditor);

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editor.classList.toggle('open');
        });
    }

    document.querySelectorAll(".collapsible-header").forEach(header => {
        const content = header.nextElementSibling;
        if(content) {
            content.classList.add("collapsed");
            header.addEventListener("click", () => content.classList.toggle("collapsed"));
        }
    });

    const passiveTitleSidebar = document.getElementById('input-passive-name-sidebar');
    const passiveTitleCard = document.querySelector('.passive-name-display');
    if (passiveTitleSidebar && passiveTitleCard) {
        passiveTitleSidebar.addEventListener("input", function() {
            passiveTitleCard.innerText = this.value;
        });
    }

    window.uploadedArtFile = null;
    window.uploadedArtType = null;
    window.uploadedArtImageFile = null;
    window.uploadedArtVideoFile = null;

    const vidUpload = document.getElementById('videoUpload');
    const imgUpload = document.getElementById('imageUpload');
    const vidOverlay = document.getElementById('myOverlayVideo');
    const imgOverlay = document.getElementById('myOverlayImage');

    if (vidUpload && vidOverlay && imgOverlay) {
        vidUpload.addEventListener("change", function(event) {
            const f = event.target.files[0];
            if(f) {
                window.uploadedArtVideoFile = f;
                window.uploadedArtFile = f; 
                window.uploadedArtType = 'video';
                delete vidOverlay.dataset.failed;
                vidOverlay.style.display = 'block';
                imgOverlay.style.display = 'none';
                vidOverlay.pause();
                const objUrl = URL.createObjectURL(f);
                const source = vidOverlay.querySelector('source');
                vidOverlay.removeAttribute('src');
                if (source) source.src = objUrl;
                vidOverlay.load();
                vidOverlay.play().catch(() => {});

                const dbArtVid = document.getElementById('abs-art-video');
                if (dbArtVid) {
                    dbArtVid.src = objUrl;
                    delete dbArtVid.dataset.failed;
                    dbArtVid.load();
                }

                if (window.syncToAbsLayout) window.syncToAbsLayout();
                if (window.switchEditorArtMode) window.switchEditorArtMode('animated');
            }
        });
    }

    if (imgUpload && imgOverlay && vidOverlay) {
        imgUpload.addEventListener("change", function(event) {
            const f = event.target.files[0];
            if(f) {
                window.uploadedArtImageFile = f;
                window.uploadedArtFile = f; 
                window.uploadedArtType = 'image';
                imgOverlay.style.display = 'block';
                vidOverlay.style.display = 'none';
                vidOverlay.pause(); 
                const objUrl = URL.createObjectURL(f);
                imgOverlay.src = objUrl;
                delete imgOverlay.dataset.failed;
                delete imgOverlay.dataset.officialCardArt;

                const dbArtImg = document.getElementById('abs-art-img');
                if (dbArtImg) {
                    dbArtImg.src = objUrl;
                    delete dbArtImg.dataset.failed;
                    delete dbArtImg.dataset.officialCardArt;
                }

                if (window.syncToAbsLayout) window.syncToAbsLayout();
                if (window.switchEditorArtMode) window.switchEditorArtMode('static');
            }
        });
    }

    [vidOverlay, document.getElementById('abs-art-video')].forEach(video => {
        if (!video) return;
        video.addEventListener('loadedmetadata', () => {
            delete video.dataset.failed;
            window.refreshEditorArtModeAvailability?.();
        });
        video.addEventListener('error', () => {
            video.dataset.failed = 'true';
            window.refreshEditorArtModeAvailability?.();
        });
    });
    [imgOverlay, document.getElementById('abs-art-img'), document.getElementById('abs-art-bg'), document.getElementById('abs-art-char'), document.getElementById('abs-art-effect')].forEach(image => {
        if (!image) return;
        image.addEventListener('load', () => {
            delete image.dataset.failed;
            window.refreshEditorArtModeAvailability?.();
        });
        image.addEventListener('error', () => {
            image.dataset.failed = 'true';
            window.refreshEditorArtModeAvailability?.();
        });
    });

    // ONLY RUN INITIALIZATION & CACHE LOAD IF IN EDITOR MODE (NOT PUBLISHED)
    if (!window.IS_PUBLISHED) {
        if (!window.location.search.includes('reset=')) {
            window.loadFromCache();
            
            // Run autosave every 15 seconds silently in the background
            setInterval(() => {
                if (!window.IS_RESETTING) {
                    window.autoSaveToCache();
                }
            }, 15000);

            // Save on window unload unless resetting
            window.addEventListener('beforeunload', () => {
                if (!window.IS_RESETTING) {
                    window.autoSaveToCache();
                }
            });
        }
        
        // Setup default DOM structure ONLY in editor
        window.updateRarityStats(currentRarity);
        window.updateIdentity();
        window.updateIconImages();
        window.refreshSADropdown();
        window.refreshActiveDropdown(); 
        window.refreshFormList();
        window.updateCardDisplay(); 
        if (window.renderPassiveHeaderBadgeToggles) window.renderPassiveHeaderBadgeToggles();

        // Enforce saved or default theme on editor startup
        const savedTheme = localStorage.getItem('dokkan_selected_theme') || 'dokkaninfo';
        if (window.toggleCardTheme) {
            window.toggleCardTheme(savedTheme === 'abs-style');
        }

        // Cached links render before the Dokkan database is available. Load it
        // once on startup so their level 10 hover effects and linking partners
        // are refreshed without requiring the user to add another link first.
        setTimeout(() => {
            if (document.querySelector('#card-link-container a')) {
                window.refreshEditorLinkingPartners?.();
            }
        }, 200);

        // Right-click on card art canvas to pause / resume LWF animation
        const cardArtWrappers = document.querySelectorAll('.card-art-canvas, .abs-card-art-container');
        cardArtWrappers.forEach(wrapper => {
            wrapper.addEventListener('contextmenu', function(e) {
                const infoCanvas = document.getElementById('info-card-bg-lwf-canvas');
                const absCanvas = document.getElementById('abs-card-bg-lwf-canvas');
                const targetCanvas = (infoCanvas && infoCanvas.classList.contains('lwf-active')) ? infoCanvas : (absCanvas && absCanvas.classList.contains('lwf-active') ? absCanvas : null);

                if (targetCanvas && window.DokkanLWF) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof window.DokkanLWF.togglePlay === 'function') {
                        const isPlaying = window.DokkanLWF.togglePlay(targetCanvas.id);
                        if (infoCanvas && infoCanvas.id !== targetCanvas.id) window.DokkanLWF.togglePlay(infoCanvas.id);
                        if (absCanvas && absCanvas.id !== targetCanvas.id) window.DokkanLWF.togglePlay(absCanvas.id);
                        console.log(`[LWF Animation] Card art ${isPlaying ? 'Resumed' : 'Paused'}`);
                    }
                }
            });
        });
    }
});
