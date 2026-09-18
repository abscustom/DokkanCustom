/* ============================================================
   THEME MANAGER & ABS LAYOUT SYNCHRONIZER
   ============================================================ */

function ensureAbsCleanCategoryCountDatabase() {
    const database = window.DB;
    const databaseReady = Array.isArray(database?.cards) && database.cards.length > 0 &&
        database.categories && Object.keys(database.categories).length > 0;
    if (databaseReady || typeof window.ensureDokkanDatabase !== 'function') return;
    if (window.__absCleanCategoryCountDatabaseRequested) return;

    window.__absCleanCategoryCountDatabaseRequested = true;
    const databasePromise = window.editorDokkanDatabasePromise || (
        window.editorDokkanDatabasePromise = Promise.resolve(window.ensureDokkanDatabase())
            .finally(() => { window.editorDokkanDatabasePromise = null; })
    );

    Promise.resolve(databasePromise).then((loadedDatabase) => {
        const cards = loadedDatabase?.cards || window.DB?.cards;
        if (!Array.isArray(cards) || !cards.length) return;
        // The first render may have happened before cards.json completed.
        // Re-run the existing sync so its category badges receive real counts.
        window.syncToAbsLayout?.();
    }).catch((error) => {
        console.warn('[ABS Clean] Category count database load failed:', error);
    });
}

window.toggleCardTheme = function(isDbTheme) {
    const appEl = document.getElementById('app');
    const layoutInfo = document.getElementById('layout-dokkaninfo');
    const layoutDb = document.getElementById('layout-abs-style');
    
    const btnInfo = document.getElementById('theme-btn-info');
    const btnDb = document.getElementById('theme-btn-abs');
    const btnSba = document.getElementById('theme-btn-sba');
    
    window.currentCardThemeStyle = isDbTheme ? 'abs-style' : 'dokkaninfo';
    window.currentCardThemeVariant = isDbTheme ? 'abs-style' : 'dokkaninfo';
    localStorage.setItem('dokkan_selected_theme', window.currentCardThemeStyle); 
    // Published custom cards share this preference across linked pages. Keep it
    // separate from the editor's own saved layout so opening the editor does
    // not unexpectedly change the public card view.
    if (window.IS_PUBLISHED) {
        localStorage.setItem('dokkan_published_card_theme', window.currentCardThemeStyle);
    }
    window.updateSiteFavicon?.(window.currentCardThemeStyle);

    // Apply class updates BEFORE running syncToAbsLayout so theme checks (e.g. isAbsCleanTheme) are accurate
    if (isDbTheme) {
        if (appEl) {
            appEl.classList.add('theme-abs-style');
            appEl.classList.remove('theme-dokkaninfo', 'theme-sba', 'theme-abs-clean');
        }
        document.body.classList.add('theme-abs-style');
        document.body.classList.remove('theme-dokkaninfo', 'theme-sba', 'theme-abs-clean');
        delete document.body.dataset.absCleanType;
        document.body.style.removeProperty('--theme-main');
        document.body.style.removeProperty('--theme-border');
        document.body.style.removeProperty('--theme-header');
        document.body.style.removeProperty('--theme-text');

        if (btnInfo) btnInfo.classList.remove('active');
        if (btnDb) btnDb.classList.add('active');
        if (btnSba) btnSba.classList.remove('active');
    } else {
        if (appEl) {
            appEl.classList.remove('theme-abs-style', 'theme-sba', 'theme-abs-clean');
            appEl.classList.add('theme-dokkaninfo');
        }
        document.body.classList.remove('theme-abs-style', 'theme-sba', 'theme-abs-clean');
        document.body.classList.add('theme-dokkaninfo');
        delete document.body.dataset.absCleanType;
        document.body.style.removeProperty('--theme-main');
        document.body.style.removeProperty('--theme-border');
        document.body.style.removeProperty('--theme-header');
        document.body.style.removeProperty('--theme-text');

        if (btnInfo) btnInfo.classList.add('active');
        if (btnDb) btnDb.classList.remove('active');
        if (btnSba) btnSba.classList.remove('active');
    }

    if (layoutInfo && layoutDb) {
        if (isDbTheme) {
            layoutInfo.style.display = 'none';
            layoutDb.style.display = 'block';
        } else {
            layoutDb.style.display = 'none';
            layoutInfo.style.display = 'block';
        }
    }

    if (isDbTheme && window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }

    window.syncAbsCleanLinkSkillsPlacement?.();
    window.syncAbsCleanLeaderPlacement?.();
    window.syncAbsCleanRightRail?.();
    window.syncAbsCleanSuperAttackPlacement?.();
    window.syncAbsCleanAwakeningFormsPlacement?.();
    window.syncAbsCleanHeaderComposition?.();
    window.syncAbsCleanPassiveSummary?.();
    window.syncAbsCleanLinkPartnersPlacement?.();
    if (isDbTheme) {
        window.refreshEditorLinkingPartners?.();
    }
};


window.setAbsCleanBackgroundMode = function(mode) {
    // abs.clean is intentionally a single dark presentation. Keep this
    // public function as a compatibility shim for older callers, but do not
    // allow a persisted setting or stale button callback to restore light.
    const isDark = true;
    const finalMode = 'dark';
    try {
        localStorage.setItem('abs_clean_bg_mode', finalMode);
    } catch(e) {}

    const targets = [document.body, document.documentElement];
    targets.forEach(t => {
        if (!t) return;
        if (isDark) t.classList.add('theme-abs-clean-dark');
        else t.classList.remove('theme-abs-clean-dark');
        // Keep an explicit state marker alongside the legacy class.  The clean
        // stylesheet can use this marker as the last word in the cascade when
        // an older theme/type rule has left a stale dark surface behind.
        t.dataset.absCleanMode = finalMode;
    });

    const lightBtn = document.getElementById('abs-clean-mode-light');
    const darkBtn = document.getElementById('abs-clean-mode-dark');
    if (lightBtn && darkBtn) {
        if (isDark) {
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        } else {
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        }
    }
};

window.initAbsCleanBackgroundMode = function() {
    window.setAbsCleanBackgroundMode('dark');
};

window.switchCardTheme = function(themeName) {
    if (themeName === 'sba' || themeName === 'abs.clean' || themeName === 'abs-clean') {
        const appEl = document.getElementById('app');
        const layoutInfo = document.getElementById('layout-dokkaninfo');
        const layoutDb = document.getElementById('layout-abs-style');

        window.currentCardThemeStyle = 'abs-style';
        window.currentCardThemeVariant = 'sba';
        localStorage.setItem('dokkan_selected_theme', 'sba');
        localStorage.setItem('hub_selected_style', 'sba');
        if (window.IS_PUBLISHED) localStorage.setItem('dokkan_published_card_theme', 'sba');
        window.updateSiteFavicon?.('abs-style');

        if (layoutInfo && layoutDb) {
            layoutInfo.style.display = 'none';
            layoutDb.style.display = 'block';
        }

        appEl?.classList.remove('theme-abs-style', 'theme-dokkaninfo');
        appEl?.classList.add('theme-sba', 'theme-abs-clean');
        document.body.classList.remove('theme-abs-style', 'theme-dokkaninfo');
        document.body.classList.add('theme-sba', 'theme-abs-clean');

        document.getElementById('theme-btn-info')?.classList.remove('active');
        document.getElementById('theme-btn-abs')?.classList.remove('active');
        document.getElementById('theme-btn-sba')?.classList.add('active');

        window.syncToAbsLayout?.();
        window.syncAbsCleanLinkSkillsPlacement?.();
        window.syncAbsCleanLeaderPlacement?.();
        window.syncAbsCleanRightRail?.();
        window.syncAbsCleanSuperAttackPlacement?.();
        window.syncAbsCleanAwakeningFormsPlacement?.();
        window.syncAbsCleanHeaderComposition?.();
        window.syncAbsCleanLinkPartnersPlacement?.();
        window.refreshEditorLinkingPartners?.();
        requestAnimationFrame(() => window.refreshAbsCleanAsciiBg?.());
        window.dispatchEvent(new Event('abs-clean-theme-visible'));
        window.startAbsCleanGridCircuit?.();
        window.initAbsCleanBackgroundMode?.();
        return;
    }
    const isDbTheme = (themeName === 'abs-style');
    window.toggleCardTheme(isDbTheme);
};

// abs.clean keeps Categories as a narrow sibling beside Passive while Link
// Skills retain their separate presentation. Other themes keep every box in
// its original slot.
window.syncAbsCleanLinkSkillsPlacement = function() {
    const linkSkillsBox = document.getElementById('abs-link-skills-box');
    const legacySlot = document.getElementById('abs-link-skills-legacy-slot');
    const catContainer = document.getElementById('abs-category-container');
    const catBox = catContainer?.closest('.abs-box') || null;
    const categoryLinksColumn = document.getElementById('abs-clean-category-links-column');
    if (!linkSkillsBox || !legacySlot || !catBox) return;

    // Remember the categories box home once, so non-clean themes restore exactly.
    if (!window.__absCleanCatHome) {
        window.__absCleanCatHome = {
            parent: catBox.parentElement,
            next: catBox.nextElementSibling
        };
    }

    const isClean = document.body.classList.contains('theme-abs-clean');
    if (!isClean) {
        linkSkillsBox.style.order = '';
        catBox.style.order = '';
        catBox.classList.remove('abs-clean-below-l');
        linkSkillsBox.classList.remove('abs-clean-below-l');
        if (linkSkillsBox.parentElement !== legacySlot) legacySlot.appendChild(linkSkillsBox);
        window.restoreAbsCleanCategoryLinksColumn?.();
        const home = window.__absCleanCatHome;
        if (home && home.parent && catBox.parentElement !== home.parent) {
            if (home.next && home.next.parentElement === home.parent) home.parent.insertBefore(catBox, home.next);
            else home.parent.appendChild(catBox);
        }
        document.getElementById('abs-clean-side-duo-slot')?.remove?.();
        window.restoreAbsCleanCategoryArt?.();
        window.syncAbsCleanRightRail?.();
        window.syncAbsCleanAwakeningFormsPlacement?.();
        window.syncAbsCleanLinkPartnersPlacement?.();
        return;
    }

    const mainCol = document.querySelector('#layout-abs-style .abs-main-col');
    if (!mainCol) return;

    document.getElementById('abs-clean-side-duo-slot')?.remove?.();
    catBox.classList.remove('abs-clean-below-l');
    linkSkillsBox.classList.remove('abs-clean-below-l');
    catBox.classList.remove('abs-clean-under-header');
    linkSkillsBox.classList.remove('abs-clean-under-header');
    catBox.style.order = '';
    linkSkillsBox.style.order = '';
    const passiveBox = document.getElementById('abs-passive-skill-box');
    const categoryAwakeningsRow = document.getElementById('abs-clean-category-awakenings-row');
    const categoryIsInCleanSplit = catBox.parentElement === categoryAwakeningsRow;
    const categoryIsInUtilityColumn = catBox.parentElement === categoryLinksColumn;
    if (passiveBox && !categoryIsInCleanSplit && !categoryIsInUtilityColumn &&
        (catBox.parentElement !== mainCol || passiveBox.nextElementSibling !== catBox)) {
        passiveBox.insertAdjacentElement('afterend', catBox);
    }
    catBox.hidden = false;
    catContainer.hidden = false;
    catBox.removeAttribute('hidden');
    catContainer.removeAttribute('hidden');
    window.restoreAbsCleanCategoryArt?.();
    window.syncAbsCleanRightRail?.();
    window.syncAbsCleanAwakeningFormsPlacement?.();
    window.syncAbsCleanLinkPartnersPlacement?.();
};

// abs.clean alone promotes Leader Skill to the full-width site banner. The
// display-contents legacy slot preserves the original grid position elsewhere.
window.syncAbsCleanLeaderPlacement = function() {
    const leaderBox = document.getElementById('abs-leader-skill-box');
    const cleanSlot = document.getElementById('abs-clean-leader-banner-slot');
    const legacySlot = document.getElementById('abs-leader-skill-legacy-slot');
    if (!leaderBox || !cleanSlot || !legacySlot) return;

    const target = document.body.classList.contains('theme-abs-clean') ? cleanSlot : legacySlot;
    if (leaderBox.parentElement !== target) target.appendChild(leaderBox);
};

// abs.clean header composition: identity badges stay in the header, the live
// HP/ATK/DEF rail stays outside the art dock, and passive ability badges plus
// percentage totals live inside the actual Passive Skill header. Forms have
// their own dedicated surface and are never copied into the header.
window.syncAbsCleanHeaderComposition = function() {
    const header = document.querySelector('#layout-abs-style .abs-top-header');
    const headerLeft = document.querySelector('#layout-abs-style .abs-header-left');
    const identity = document.getElementById('abs-clean-identity-icons');
    const statsBox = document.getElementById('abs-stats-box');
    const statsRow = statsBox?.querySelector('.abs-stat-cards-row');
    const abilityDocks = document.getElementById('abs-clean-ability-docks');
    const passiveSummary = document.getElementById('abs-passive-summary');
    if (!header || !headerLeft) return;

    const isClean = document.body.classList.contains('theme-abs-clean');
    if (identity && !window.__absCleanIdentityHome) {
        window.__absCleanIdentityHome = {
            parent: identity.parentElement,
            next: identity.nextElementSibling
        };
    }

    // Record the real stats shell before clean mode repositions anything. The
    // original parent/next sibling lets a later theme switch restore the
    // editor's native DOM without relying on a stale header placeholder.
    if (statsBox && !window.__absCleanStatsHome) {
        window.__absCleanStatsHome = {
            box: statsBox,
            parent: statsBox.parentElement,
            next: statsBox.nextElementSibling,
            row: statsRow,
            order: statsRow ? Array.from(statsRow.querySelectorAll(':scope > .abs-stat-card')) : []
        };
    }

    if (abilityDocks && !window.__absCleanAbilityDocksHome) {
        // A hot reload can leave the live node in the clean Passive box. Do
        // not record that temporary clean location as the native home used
        // when another theme is restored.
        const passiveBox = document.getElementById('abs-passive-skill-box');
        const passiveName = passiveBox?.querySelector(':scope > #abs-passive-name') ||
            document.getElementById('abs-passive-name');
        const legacyRail = document.getElementById('abs-clean-header-badges-rail');
        const currentParent = abilityDocks.parentElement;
        const wasCleanMoved = currentParent === passiveBox ||
            currentParent === passiveName ||
            currentParent === legacyRail;
        const nativeParent = wasCleanMoved
            ? (headerLeft || document.querySelector('#layout-abs-style .abs-side-col'))
            : currentParent;
        if (nativeParent && nativeParent !== passiveBox && !abilityDocks.contains(nativeParent)) {
            const nativeNext = wasCleanMoved
                ? (nativeParent.classList.contains('abs-header-left')
                    ? nativeParent.firstElementChild
                    : nativeParent.querySelector(':scope > #abs-stats-box'))
                : abilityDocks.nextElementSibling;
            window.__absCleanAbilityDocksHome = {
                parent: nativeParent,
                next: nativeNext
            };
        }
    }

    if (!isClean) {
        document.getElementById('abs-clean-header-form-portraits')?.remove();
        const timeline = document.getElementById('abs-clean-bottom-timeline');
        if (timeline) timeline.hidden = true;
        const passiveSummary = document.getElementById('abs-passive-summary');
        if (passiveSummary) {
            passiveSummary.innerHTML = '';
            passiveSummary.hidden = true;
        }
        if (identity) {
            identity.hidden = true;
            identity.classList.remove('abs-clean-header-identity');
            const home = window.__absCleanIdentityHome;
            if (home?.parent && identity.parentElement !== home.parent) {
                if (home.next?.parentElement === home.parent) home.parent.insertBefore(identity, home.next);
                else home.parent.appendChild(identity);
            }
        }
        // Restore the HP/ATK/DEF cards to their original stats row in order.
        const statHome = window.__absCleanStatsHome || window.__absCleanHeaderStatsHome;
        if (statHome?.row) {
            statHome.order.forEach(card => { if (card.isConnected) statHome.row.appendChild(card); });
        }
        const homeBox = statHome?.box || statsBox;
        if (homeBox && statHome?.parent && homeBox.parentElement !== statHome.parent) {
            const homeNext = statHome.next;
            if (homeNext?.parentElement === statHome.parent && homeNext !== homeBox && !homeBox.contains(homeNext)) {
                statHome.parent.insertBefore(homeBox, homeNext);
            } else {
                statHome.parent.appendChild(homeBox);
            }
        }
        statsBox?.classList.remove('abs-clean-stats-under-art', 'abs-clean-stats-above-art');
        window.syncAbsCleanStatsAndArtPlacement?.();
        statsBox?.removeAttribute('hidden');
        if (abilityDocks) {
            const abilityHome = window.__absCleanAbilityDocksHome;
            abilityDocks.classList.remove('abs-clean-ability-docks-under-art');
            if (abilityHome?.parent && abilityDocks.parentElement !== abilityHome.parent) {
                if (abilityHome.next?.parentElement === abilityHome.parent && abilityHome.next !== abilityDocks && !abilityDocks.contains(abilityHome.next)) {
                    abilityHome.parent.insertBefore(abilityDocks, abilityHome.next);
                } else {
                    abilityHome.parent.appendChild(abilityDocks);
                }
            }
        }
        window.syncAbsCleanAbilityDockPlacement?.();
        document.getElementById('abs-clean-header-badges-rail')?.remove();
        document.getElementById('abs-clean-header-stats')?.remove();
        document.getElementById('layout-abs-style')?.style.removeProperty('--abs-clean-art-frame-height');
        return;
    }

    const timeline = document.getElementById('abs-clean-bottom-timeline');
    if (timeline) timeline.hidden = false;

    // Identity badges sit top-left of the header, above the portrait/name row.
    if (identity) {
        identity.hidden = false;
        identity.classList.add('abs-clean-header-identity');
        if (identity.parentElement !== header || header.firstElementChild !== identity) header.prepend(identity);
    }

    // The shared placement helper keeps the live badge strip and totals inside
    // the actual Passive Skill header; do not recreate either node here.

    // Older sessions can still have the legacy duplicate rail in the DOM.
    // Remove it instead of allowing a second copy of the Forms portraits to
    // reappear whenever the clean layout is synchronized.
    document.getElementById('abs-clean-header-form-portraits')?.remove();
    window.syncAbsCleanRailHeight?.();

    // Keep the stat shell outside the card-art dock, not in the header. The
    // shared clean synchronizer places it as a separate sibling below the art.
    const statHome = window.__absCleanStatsHome || window.__absCleanHeaderStatsHome;
    if (statsBox && statHome?.row) {
        statHome.order.forEach(card => { if (card.isConnected) statHome.row.appendChild(card); });
        statsBox.hidden = false;
        statsBox.classList.remove('abs-clean-stats-under-art');
        statsBox.classList.add('abs-clean-stats-above-art');
    }

    window.syncAbsCleanStatsAndArtPlacement?.();

    // The clean partner/category synchronizer creates the right-hand utility
    // track. The shared placement helper keeps the live badges and totals in
    // the actual Passive Skill header; never duplicate either node here.
    window.syncAbsCleanLinkPartnersPlacement?.();
    window.syncAbsCleanAbilityDockPlacement?.();
    // Remove a stale node left by an older clean-mode session.
    document.getElementById('abs-clean-header-stats')?.remove();
};

// The L-rail ends exactly at the art's visual bottom plus the rail lip, so
// boxes below it (Categories, Link Skills) never overlap the rail end.
// Falls back to the CSS default until layout settles.
window.syncAbsCleanRailHeight = function() {
    document.getElementById('abs-clean-portrait-stage')?.style.removeProperty('margin-bottom');
};

window.restoreThemeOnLoad = function() {
    if (window.IS_PUBLISHED) {
        const rememberedTheme = localStorage.getItem('dokkan_published_card_theme');
        const themeToRestore = rememberedTheme === 'abs-style' || rememberedTheme === 'dokkaninfo' || rememberedTheme === 'sba' || rememberedTheme === 'abs.clean' || rememberedTheme === 'abs-clean'
            ? rememberedTheme
            : window.currentCardThemeStyle;
        if (themeToRestore) {
            window.switchCardTheme(themeToRestore);
        }
    }
};

// LWF players are intentionally kept in memory, so a browser refresh removes
// them even though the editor's cached markup and settings remain.  Queue one
// small hydration pass after cache/theme restoration and after the shared LWF
// module announces that it is ready.  The bounded retry only covers a slow
// module fetch and never creates a reload/polling loop.
let editorLwfHydrationTimer = null;
let editorLwfHydrationAttempt = 0;
let editorLwfHydrationRunning = false;

window.scheduleEditorLwfHydration = function(delay = 0) {
    if (editorLwfHydrationTimer) clearTimeout(editorLwfHydrationTimer);
    editorLwfHydrationTimer = setTimeout(async () => {
        editorLwfHydrationTimer = null;

        if (!window.DokkanLWF) {
            if (editorLwfHydrationAttempt < 8) {
                editorLwfHydrationAttempt += 1;
                window.scheduleEditorLwfHydration(250);
            }
            return;
        }

        if (editorLwfHydrationRunning) return;
        editorLwfHydrationRunning = true;
        editorLwfHydrationAttempt = 0;
        try {
            // This mounts clean type/SEZA effects now that the theme classes
            // and the LWF API are both present.
            window.syncToAbsLayout?.();
            // This restores official card-background LWFs using the persisted
            // card identity (custom cards simply return without doing work).
            await window.restoreEditorLwfs?.();
        } catch (error) {
            console.warn('[Editor LWF] Reload hydration failed:', error);
        } finally {
            editorLwfHydrationRunning = false;
        }
    }, Math.max(0, Number(delay) || 0));
};

window.addEventListener('dokkan-lwf-ready', () => {
    window.scheduleEditorLwfHydration?.();
});

window.addEventListener('abs-editor-content-ready', () => {
    window.scheduleEditorLwfHydration?.();
});

// Auto-detect in-game ability strip from passive text (matching Card Viewer 1:1)
function detectPassiveIconsFromText(text) {
    if (!text) return [];
    const t = text.toLowerCase();
    const detected = new Map();

    const registerIcon = (filename, tooltip) => {
        if (!detected.has(filename)) {
            detected.set(filename, { src: `https://abscustom.github.io/assets/images/${filename}`, tooltip: tooltip });
        }
    };

    if (/reversible\s+exchange/i.test(t) || /can\s+switch\s+back/i.test(t) || /exchange\s+with/i.test(t) || /reversible/i.test(t)) {
        registerIcon('st_reversible.png', 'Reversible Exchange');
    }
    if (/transforms?\s+(starting|when|into|upon|after)/i.test(t) || /\btransforms\b/i.test(t) || /transfers?\s+to\s+another/i.test(t) || /switches?\s+(with|to)/i.test(t) || /can\s+switch\s+to/i.test(t)) {
        registerIcon('st_change_form.png', 'Transformation');
    }
    if (/giant\s+form/i.test(t) || /rage\s+(mode|form)/i.test(t) || /turns?\s+into\s+a\s+giant/i.test(t) || /great\s+ape/i.test(t)) {
        registerIcon('st_giant_form_rage.png', 'Giant Form / Rage');
    }
    if (/reviv(e|al|ed|es)/i.test(t) || /when\s+hp\s+is\s+0/i.test(t) || /revived\s+by\s+the\s+power/i.test(t) || /activates?\s+revival/i.test(t)) {
        registerIcon('st_revive.png', 'Revival Skill');
    }
    if (/survives?\s+(a\s+)?k\.?o\.?/i.test(t) || /fatal\s+damage/i.test(t) || /survives?\s+fatal/i.test(t)) {
        registerIcon('st_invalid_ko.png', 'Survives Fatal KO Attack');
    }
    if (/nullif(y|ies)\s+all\s+(negative|abnormal)/i.test(t) || /immune\s+to\s+negative/i.test(t)) {
        registerIcon('nullifies_negative_effects.png', 'Nullifies Negative Effects');
    }
    if (/atk\s*(&\s*def)?\s*(\+?\s*\d+%|up\s+to)/i.test(t) || 
        /(raises?|boosts?)\s+(own\s+)?atk/i.test(t) || 
        /atk\s*\+\d+%/i.test(t) ||
        /\batk\s+\d+%/i.test(t) ||
        (/atk\s*&/i.test(t) && /\d+%/i.test(t))) {
        registerIcon('st_0001.png', 'ATK Boost');
    }
    if (/def\s*(&\s*atk)?\s*(\+?\s*\d+%|up\s+to)/i.test(t) || 
        /(raises?|boosts?)\s+(own\s+)?def/i.test(t) || 
        /def\s*\+\d+%/i.test(t) ||
        /\bdef\s+\d+%/i.test(t) ||
        (/&\s*def/i.test(t) && /\d+%/i.test(t))) {
        registerIcon('st_0002.png', 'DEF Boost');
    }
    if (/ki\s*\+\s*\d+(?!\s+per)/i.test(t) || /plus\s+ki\s*\+\d+/i.test(t) || /ki\s*meter/i.test(t) || /\bki\s*\+\d+\b/i.test(t)) {
        registerIcon('st_0003.png', 'Ki Boost');
    }
    if (/additional\s+(attack|super)/i.test(t) || 
        /launches?\s+.*?\s+additional/i.test(t) || 
        /attacks?\s+twice/i.test(t) || 
        /attacks?\s+become\s+a\s+super/i.test(t)) {
        registerIcon('st_atk_combo.png', 'Additional Attack');
    }
    if (/critical/i.test(t)) {
        registerIcon('st_critical_up.png', 'Critical Hit');
    }
    if (/effective\s+against\s+all\s+types/i.test(t)) {
        registerIcon('st_atk_super.png', 'Effective Against All Types');
    }
    if (/guaranteed\s+to\s+hit/i.test(t) || /attacks?\s+cannot\s+be\s+evaded/i.test(t) || /attacks?\s+cannot\s+be\s+dodged/i.test(t)) {
        registerIcon('st_always_hit.png', 'Attacks Guaranteed to Hit');
    }
    if (/interrupts?\s+(the\s+)?attacked\s+enemy/i.test(t) || 
        /disables?\s+enemy'?s?\s+action/i.test(t) || 
        /action\s+break/i.test(t) || 
        /:break:/i.test(t)) {
        registerIcon('st_1009.png', 'Action Break / Interrupts Enemy');
    }
    if (/guard\s+against\s+all\s+types/i.test(t) || /guards?\s+all\s+attacks/i.test(t) || /guard\s+is\s+activated/i.test(t) || /active\s+guard/i.test(t) || /guard/i.test(t)) {
        registerIcon('st_sp_guard.png', 'Guard Against All Attacks');
    }
    if (/damage\s+reduction/i.test(t) || /reduces?\s+damage/i.test(t) || /damage\s+received/i.test(t)) {
        registerIcon('st_resist_damage_up.png', 'Damage Reduction');
    }
    if (/evad(e|ing|es|ion)/i.test(t) || /dodg(e|ing|es)/i.test(t)) {
        registerIcon('st_evasion.png', 'High Evasion / Dodge');
    }
    if (/disables?\s+(enemy'?s?\s+)?guard/i.test(t) || /guard\s+disabled/i.test(t)) {
        registerIcon('st_disable_guard.png', 'Disables Enemy Guard');
    }
    if (/changes?\s+.*?(ki\s+spheres?|spheres?|balls?)/i.test(t) || /rainbow\s+ki\s+spheres?/i.test(t)) {
        registerIcon('ki_change_rainbow.png', 'Ki Sphere Changer');
    }
    if (/(receives?\s+an?\s+additional\s+ki|plus\s+an?\s+additional\s+ki|additional\s+ki\s*\+\d+|ki\s*\+\d+)\s+per\s+.*?(ki\s+sphere|sphere)/i.test(t) ||
        /plus\s+ki\s*\+\d+\s+per\s+.*?\s+obtained/i.test(t)) {
        registerIcon('additional_ki_obtained.png', 'Additional Ki Per Ki Sphere Obtained');
    }
    if (/recovers?\s+(\d+%\s*hp|\d+%\s*of\s+damage|hp)/i.test(t) || /hp\s+recovery/i.test(t) || /recovers?\s+hp/i.test(t)) {
        registerIcon('st_recover.png', 'HP Recovery');
    }
    if (/sacrific(e|es|ing)\s+(\d+%\s*hp|hp)/i.test(t)) {
        registerIcon('st_recover_minus.png', 'HP Sacrifice');
    }
    if (/(all\s+)?enemies'?\s+atk/i.test(t) || 
        /enemy'?s?\s+atk\s*(&\s*def)?\s*(\d+%\s*|\b(down|lower|decrease))/i.test(t) || 
        /attacked\s+enemy'?s?\s+atk/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemies'?\s+atk/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemy'?s?\s+atk/i.test(t) ||
        /atk\s*(-?\d+%\s*)?(:down:|:ydown:)/i.test(t) ||
        /:atk_down:/i.test(t) ||
        /:ydown:/i.test(t)) {
        registerIcon('st_0011.png', 'Lowers Enemy ATK');
    }
    if (/(all\s+)?enemies'?\s+(atk\s*&\s*)?def/i.test(t) || 
        /enemy'?s?\s+def\s*(&\s*atk)?\s*(\d+%\s*|\b(down|lower|decrease))/i.test(t) || 
        /attacked\s+enemy'?s?\s+(atk\s*&\s*)?def/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemies'?\s+def/i.test(t) ||
        /lowers?\s+(the\s+)?(all\s+|attacked\s+)?enemy'?s?\s+def/i.test(t) ||
        /def\s*(-?\d+%\s*)?(:down:|:ydown:)/i.test(t) ||
        /:def_down:/i.test(t)) {
        registerIcon('st_0012.png', 'Lowers Enemy DEF');
    }
    if (/stun(s|ing)?/i.test(t) || /:stun:/i.test(t)) {
        registerIcon('st_0100.png', 'Stuns Enemy');
    }
    if (/seal(s|ing)?\s+(the\s+)?(attacked\s+)?enemy/i.test(t) || /seals?\s+super\s+attack/i.test(t) || /:seal:/i.test(t)) {
        registerIcon('st_0102.png', 'Seals Enemy Super Attack');
    }
    if (/directs?\s+(all\s+)?enemy'?s?\s+attacks/i.test(t) || /taunt/i.test(t) || /target\s+skill/i.test(t)) {
        registerIcon('st_target.png', 'Directs Enemy Attacks (Taunt)');
    }
    if (/unarmed\s+super\s+attack/i.test(t) || /melee\s+super\s+attack/i.test(t) || /physical\s+super\s+attack/i.test(t) || /(nullif(y|ies)|counter)\s+(unarmed|melee|physical)/i.test(t) || /(nullif(y|ies)|counter)\s+(enemy'?s?\s+)?super/i.test(t)) {
        registerIcon('st_invalid_blow_special.png', 'Counter / Nullify Melee Super');
    }
    if (/ki\s+blast\s+super\s+attack/i.test(t) || /energy\s+super\s+attack/i.test(t) || /(nullif(y|ies)|absorb(s|ing)?)\s+ki\s+blast/i.test(t) || /counter\s+ki\s+blast/i.test(t)) {
        registerIcon('st_invalid_energy_special.png', 'Nullify / Absorb Energy Super');
    }
    if (/counters?\s+with/i.test(t) || /counters?\s+normal\s+attacks?/i.test(t) || /counter\s+attack/i.test(t)) {
        registerIcon('st_counter.png', 'Counter Attack');
    }

    const priorityOrder = [
        'st_reversible.png',
        'st_change_form.png',
        'st_giant_form_rage.png',
        'st_revive.png',
        'st_invalid_ko.png',
        'nullifies_negative_effects.png',
        'st_0001.png',
        'st_0002.png',
        'st_0003.png',
        'additional_ki_obtained.png',
        'st_atk_combo.png',
        'st_critical_up.png',
        'st_atk_super.png',
        'st_always_hit.png',
        'st_1009.png',
        'st_sp_guard.png',
        'st_resist_damage_up.png',
        'st_evasion.png',
        'st_disable_guard.png',
        'ki_change_rainbow.png',
        'st_recover.png',
        'st_recover_minus.png',
        'st_0011.png',
        'st_0012.png',
        'st_0100.png',
        'st_0102.png',
        'st_target.png',
        'st_counter.png',
        'st_invalid_blow_special.png',
        'st_invalid_energy_special.png'
    ];

    const sortedIcons = [];
    priorityOrder.forEach(file => {
        if (detected.has(file)) {
            sortedIcons.push(detected.get(file));
        }
    });

    return sortedIcons;
}

window.passiveHeaderIconsOverride = null;

window.ALL_PASSIVE_HEADER_ICONS = [
    { file: 'st_reversible.png', tooltip: 'Reversible Exchange' },
    { file: 'st_change_form.png', tooltip: 'Transformation' },
    { file: 'st_giant_form_rage.png', tooltip: 'Giant Form / Rage' },
    { file: 'st_revive.png', tooltip: 'Revival Skill' },
    { file: 'st_invalid_ko.png', tooltip: 'Survives KO' },
    { file: 'nullifies_negative_effects.png', tooltip: 'Nullifies Debuffs' },
    { file: 'st_0001.png', tooltip: 'ATK Boost' },
    { file: 'st_0002.png', tooltip: 'DEF Boost' },
    { file: 'st_0003.png', tooltip: 'Ki Boost' },
    { file: 'additional_ki_obtained.png', tooltip: 'Ki Per Sphere' },
    { file: 'st_atk_combo.png', tooltip: 'Additional Attack' },
    { file: 'st_critical_up.png', tooltip: 'Critical Hit' },
    { file: 'st_atk_super.png', tooltip: 'Effective All Types' },
    { file: 'st_always_hit.png', tooltip: 'Guaranteed Hit' },
    { file: 'st_1009.png', tooltip: 'Action Break' },
    { file: 'st_sp_guard.png', tooltip: 'Guard All Attacks' },
    { file: 'st_resist_damage_up.png', tooltip: 'Damage Reduction' },
    { file: 'st_evasion.png', tooltip: 'High Evasion / Dodge' },
    { file: 'st_disable_guard.png', tooltip: 'Disables Guard' },
    { file: 'ki_change_rainbow.png', tooltip: 'Rainbow Ki Changer' },
    { file: 'st_recover.png', tooltip: 'HP Recovery' },
    { file: 'st_recover_minus.png', tooltip: 'HP Sacrifice' },
    { file: 'st_0011.png', tooltip: 'Lowers Enemy ATK' },
    { file: 'st_0012.png', tooltip: 'Lowers Enemy DEF' },
    { file: 'st_0100.png', tooltip: 'Stun' },
    { file: 'st_0102.png', tooltip: 'Seal' },
    { file: 'st_target.png', tooltip: 'Target / Taunt' },
    { file: 'st_counter.png', tooltip: 'Counter Attack' },
    { file: 'st_invalid_blow_special.png', tooltip: 'Nullify Melee Super' },
    { file: 'st_invalid_energy_special.png', tooltip: 'Nullify Energy Super' }
];

window.togglePassiveBadgesCollapse = function(targetId, btnOrIcon) {
    const strip = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
    let btnEl = typeof btnOrIcon === 'string' ? document.getElementById(btnOrIcon) : btnOrIcon;
    if (!strip) return;
    
    const isHidden = strip.classList.contains('d-none') || strip.style.display === 'none';
    if (isHidden) {
        strip.classList.remove('d-none');
        strip.style.display = 'flex';
        if (btnEl) {
            if (btnEl.innerText === '►' || btnEl.innerText === '▼') btnEl.innerText = '▼';
            else btnEl.innerText = '−';
        }
    } else {
        strip.classList.add('d-none');
        strip.style.display = 'none';
        if (btnEl) {
            if (btnEl.innerText === '▼' || btnEl.innerText === '►') btnEl.innerText = '►';
            else btnEl.innerText = '+';
        }
    }
};

window.getActivePassiveHeaderIcons = function(passiveText) {
    if (Array.isArray(window.passiveHeaderIconsOverride)) {
        return window.passiveHeaderIconsOverride.map(file => {
            const found = window.ALL_PASSIVE_HEADER_ICONS.find(i => i.file === file);
            return {
                src: `https://abscustom.github.io/assets/images/${file}`,
                tooltip: found ? found.tooltip : file,
                file: file
            };
        });
    }
    return detectPassiveIconsFromText(passiveText);
};

window.togglePassiveHeaderIcon = function(filename, tooltip) {
    const mainPassiveCont = document.getElementById('card-passive-container');
    const rawPassiveText = mainPassiveCont ? mainPassiveCont.innerText : "";
    
    if (!Array.isArray(window.passiveHeaderIconsOverride)) {
        const auto = detectPassiveIconsFromText(rawPassiveText);
        window.passiveHeaderIconsOverride = auto.map(a => a.src.split('/').pop());
    }

    const idx = window.passiveHeaderIconsOverride.indexOf(filename);
    if (idx >= 0) {
        window.passiveHeaderIconsOverride.splice(idx, 1);
    } else {
        window.passiveHeaderIconsOverride.push(filename);
    }

    if (window.syncToAbsLayout) window.syncToAbsLayout();
    window.renderPassiveHeaderBadgeToggles();
};

window.resetPassiveHeaderIconsToAuto = function() {
    window.passiveHeaderIconsOverride = null;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    window.renderPassiveHeaderBadgeToggles();
};

window.renderPassiveHeaderBadgeToggles = function() {
    const mainPassiveCont = document.getElementById('card-passive-container');
    const rawPassiveText = mainPassiveCont ? mainPassiveCont.innerText : "";
    const activeList = window.getActivePassiveHeaderIcons(rawPassiveText);
    const activeFiles = new Set(activeList.map(a => a.src.split('/').pop().split('?')[0]));

    const html = window.ALL_PASSIVE_HEADER_ICONS.map(item => {
        const isActive = activeFiles.has(item.file);
        return `
            <button type="button" class="passive-badge-toggle-btn ${isActive ? 'active' : ''}" 
                    onclick="window.togglePassiveHeaderIcon('${item.file}', '${item.tooltip.replace(/'/g, "\\'")}')" 
                    title="${isActive ? 'Click to Remove: ' : 'Click to Add: '}${item.tooltip}">
                <img src="https://abscustom.github.io/assets/images/${item.file}" alt="${item.tooltip}">
                <span>${item.tooltip}</span>
            </button>
        `;
    }).join('');

    const sidebarStrip = document.getElementById('sidebar-passive-badges-toggle-strip');
    if (sidebarStrip) sidebarStrip.innerHTML = html;

    const guiStrip = document.getElementById('gui-passive-badges-toggle-strip');
    if (guiStrip) guiStrip.innerHTML = html;
};

function renderPassiveIconsStrip(passiveText) {
    const icons = window.getActivePassiveHeaderIcons ? window.getActivePassiveHeaderIcons(passiveText) : detectPassiveIconsFromText(passiveText);
    if (icons.length === 0) return "";

    const iconsHtml = icons.map(icon => `
        <div class="abs-passive-ability-badge" data-tooltip="${icon.tooltip}">
            <img src="${icon.src}" alt="${icon.tooltip}">
        </div>
    `).join('');

    return `
        <div class="abs-passive-icons-strip">
            ${iconsHtml}
        </div>
    `;
}

// ABS Clean now renders the unit classification as text. Keep the old public
// function name as a compatibility shim for cached pages and older callers,
// but never recreate or populate the removed summon-logo image.
window.normalizeAbsCleanUnitTag = function(unitTag) {
    const raw = String(unitTag ?? '').replace(/\s+/g, ' ').trim();
    if (!raw || /^(?:none|hidden|n\/a)$/i.test(raw)) return '';

    const normalized = raw.toUpperCase();
    if (normalized.includes('LEGENDARY SUMMON')) return 'Legendary Summon';
    if (normalized.includes('CARNIVAL')) return 'Carnival';
    if (normalized.includes('DOKKAN FESTIVAL') || normalized.includes('DOKKAN FEST')) return 'Dokkan Festival';

    const knownLabels = {
        'FREE TO PLAY': 'Free To Play',
        'FREE TO PLAY (LR)': 'Free To Play',
        'GENERAL POOL (BANNER UNIT)': 'General Pool',
        'WORLD TOURNAMENT': 'World Tournament',
        'PRIME BATTLE (F2P LR)': 'Prime Battle'
    };
    return knownLabels[normalized] || raw.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase());
};

window.syncAbsCleanUnitTag = function(unitTag = window.absUnitTag) {
    const displayTag = window.normalizeAbsCleanUnitTag(unitTag);
    const badge = document.getElementById('abs-clean-badge-tag');
    const value = document.getElementById('abs-clean-val-tag');
    if (value) value.textContent = displayTag;
    if (badge) badge.hidden = !displayTag;
    return displayTag;
};

window.syncAbsCleanSummonLogo = function(unitTag = window.absUnitTag) {
    const oldLogo = document.getElementById('abs-clean-summon-logo');
    if (oldLogo) {
        oldLogo.hidden = true;
        oldLogo.removeAttribute('src');
        oldLogo.alt = '';
    }
    return window.syncAbsCleanUnitTag(unitTag);
};

window.syncAbsCleanAwakeningPortraits = function() {
    const container = document.getElementById('abs-clean-awakening-portraits');
    const activeRarity = String(
        window.getDisplayedCardRarity?.()
        || window.currentRarity
        || (typeof currentRarity !== 'undefined' ? currentRarity : 'none')
    ).toUpperCase();
    const isAbsClean = document.body.classList.contains('theme-abs-clean');

    if (!container) return;

    const isUsableProgressionSource = (source, placeholderName) => {
        const src = String(source?.getAttribute('src') || source?.src || '').toLowerCase();
        return Boolean(src)
            && !src.includes(placeholderName)
            && !src.includes('none.png')
            && !src.includes('default.png')
            && !src.endsWith('editor.html');
    };

    const syncPortrait = ({ sourceId, portraitId, rarity, enabled }) => {
        const source = document.getElementById(sourceId);
        const portrait = document.getElementById(portraitId);
        const wrapper = portrait?.closest('.abs-clean-awakening-portrait');
        if (!portrait || !wrapper) return false;

        const usable = enabled && isUsableProgressionSource(source, `${rarity}_icon.png`);
        wrapper.hidden = !usable;
        if (usable) {
            const fallbackSrc = source.getAttribute('src') || source.src || '';
            let officialCircleSrc = source.dataset.absCleanCircleSrc;
            if (!officialCircleSrc && fallbackSrc) {
                const idMatch = fallbackSrc.match(/card_(\d+)/i) || fallbackSrc.match(/\/(\d{6,8})(?:[_\/]|\.png)/i);
                if (idMatch) {
                    const parsedId = parseInt(idMatch[1], 10);
                    const folderId = Math.floor(parsedId / 10) * 10;
                    officialCircleSrc = `./assets/card-art/cards/${folderId}/card_${folderId}_circle.png`;
                }
            }
            portrait.onerror = null;
            portrait.src = officialCircleSrc || fallbackSrc;
            if (officialCircleSrc) {
                // Legacy cards occasionally lack a circle export. Keep the
                // portrait visible by falling back to that stage's thumbnail.
                portrait.onerror = function() {
                    this.onerror = null;
                    this.src = fallbackSrc;
                };
            }
        }
        return usable;
    };

    const showSsr = syncPortrait({
        sourceId: 'img-ssr',
        portraitId: 'abs-clean-ssr-portrait',
        rarity: 'ssr',
        enabled: isAbsClean && window.showSsrProgression !== false && ['SSR', 'TUR', 'LR'].includes(activeRarity)
    });
    const showTur = syncPortrait({
        sourceId: 'img-tur',
        portraitId: 'abs-clean-tur-portrait',
        rarity: 'tur',
        enabled: isAbsClean && window.showTurProgression !== false && ['TUR', 'LR'].includes(activeRarity)
    });
    const showLr = syncPortrait({
        sourceId: 'img-lr',
        portraitId: 'abs-clean-lr-portrait',
        rarity: 'lr',
        enabled: isAbsClean && activeRarity === 'LR'
    });

    const activeStage = activeRarity.toLowerCase();
    container.querySelectorAll(':scope > .abs-clean-awakening-portrait').forEach(wrapper => {
        const stage = Array.from(wrapper.classList)
            .find(className => className.startsWith('abs-clean-awakening-portrait--'))
            ?.replace('abs-clean-awakening-portrait--', '') || '';
        wrapper.classList.toggle('is-active', !wrapper.hidden && stage === activeStage);
    });

    // Rebuild only the clean-only arrow nodes so hidden stages never leave a
    // dangling arrow behind when the displayed rarity changes.
    container.querySelectorAll(':scope > .abs-clean-awakening-arrow').forEach(arrow => arrow.remove());
    const visiblePortraits = Array.from(
        container.querySelectorAll(':scope > .abs-clean-awakening-portrait:not([hidden])')
    );
    const hasSsrStep = visiblePortraits.some(portrait => portrait.classList.contains('abs-clean-awakening-portrait--ssr'));
    visiblePortraits.forEach((portrait, index) => {
        if (index === 0) return;
        const arrow = document.createElement('span');
        arrow.className = 'abs-clean-awakening-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        // A TUR starts at the Dokkan Awakening step. An LR with the normal
        // SSR -> TUR -> LR path uses Z-Awaken under the first arrow and
        // Dokkan Awaken under the next one.
        const logoName = (activeRarity === 'TUR' || !hasSsrStep || index > 1)
            ? 'dokkan-awaken.png'
            : 'z-awaken.png';
        const stepLabel = logoName === 'z-awaken.png' ? 'z-awaken' : 'dokkan-awaken';
        arrow.setAttribute('aria-label', stepLabel);
        portrait.before(arrow);
    });

    container.hidden = visiblePortraits.length === 0;
};

window.syncToAbsLayout = function() {
    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
    const abilityDocks = document.getElementById('abs-clean-ability-docks');
    const passiveSummary = document.getElementById('abs-passive-summary');
    const isClean = isAbsCleanTheme;
    try {
        const themeColors = { 
            agl: { main: '#1d4ed8', border: '#3b82f6', header: '#1e40af', bgHigh: '#132448', bgLow: '#080e1c', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.45)' }, 
            teq: { main: '#15803d', border: '#22c55e', header: '#166534', bgHigh: '#0e341f', bgLow: '#06160d', text: '#4ade80', glow: 'rgba(74, 222, 128, 0.45)' }, 
            int: { main: '#7e22ce', border: '#a855f7', header: '#6b21a8', bgHigh: '#321654', bgLow: '#150924', text: '#c084fc', glow: 'rgba(192, 132, 252, 0.45)' }, 
            str: { main: '#b91c1c', border: '#ef4444', header: '#991b1b', bgHigh: '#441616', bgLow: '#1c0909', text: '#f87171', glow: 'rgba(248, 113, 113, 0.45)' }, 
            phy: { main: '#ca8a04', border: '#eab308', header: '#a16207', bgHigh: '#3c290f', bgLow: '#181005', text: '#fde047', glow: 'rgba(234, 179, 8, 0.45)' }, 
            none: { main: '#3f3f46', border: '#71717a', header: '#27272a', bgHigh: '#1f2533', bgLow: '#0d1017', text: '#38bdf8', glow: 'rgba(56, 189, 248, 0.35)' } 
        };
        const rawTypeKey = window.currentType || (typeof currentType !== 'undefined' ? currentType : 'none') || 'none';
        // Normalize once: an uppercase value ('AGL') misses the lowercase
        // palette keys and silently sticks the whole theme on the fallback.
        const typeKey = String(rawTypeKey).toLowerCase();
        const colors = themeColors[typeKey] || themeColors.none;
        const dbLayout = document.getElementById('layout-abs-style');
        if (dbLayout) {
            dbLayout.style.setProperty('--theme-main', colors.main);
            dbLayout.style.setProperty('--theme-border', colors.border);
            dbLayout.style.setProperty('--theme-header', colors.header);
            dbLayout.style.setProperty('--theme-bg-high', colors.bgHigh);
            dbLayout.style.setProperty('--theme-bg-low', colors.bgLow);
            dbLayout.style.setProperty('--theme-text', colors.text);
            dbLayout.style.setProperty('--theme-glow', colors.glow);
        }

        // abs.clean's type-reactive backdrop reads these from the page root.
        // Keep this scoped to that theme so ABS Style and Dokkan Info do not
        // inherit a presentation change from the shared card type picker.
        if (document.body.classList.contains('theme-abs-clean')) {
            document.body.dataset.absCleanType = typeKey;
            document.body.style.setProperty('--theme-main', colors.main);
            document.body.style.setProperty('--theme-border', colors.border);
            document.body.style.setProperty('--theme-header', colors.header);
            document.body.style.setProperty('--theme-text', colors.text);
        }

        document.querySelectorAll('.lightning-overlay').forEach(lightning => {
            lightning.style.setProperty('--lightning-color', lightningColors[window.currentType || currentType] || 'rgb(0, 150, 255)');
        });
    } catch(e) {}

    try {
        const artHeader = document.getElementById('abs-art-header-text');
        if (artHeader) {
            if (window.absUnitTag === undefined) {
                window.setAbsUnitTag?.(artHeader.dataset.unitTag || '');
            }
            // Use the shared setter so cached and published tags cannot be
            // replaced by this page's original default header text.
            window.setAbsUnitTag?.(window.absUnitTag);
            window.syncAbsCleanSummonLogo(window.absUnitTag);
        }
    } catch(e) {}

    try {
        const rawTitle = document.getElementById('descInput')?.value || document.getElementById('char-description')?.innerText || "Character Title";
        const rawName = document.getElementById('nameInput')?.value || document.getElementById('char-name')?.innerText || "Character Name";
        const dbTitle = document.getElementById('abs-char-title');
        const dbName = document.getElementById('abs-char-name');
        
        if (dbTitle) dbTitle.innerText = rawTitle.replace(/[\[\]]/g, '').trim();
        if (dbName) dbName.innerText = rawName;
    } catch(e) {}

    window.syncAbsCleanHeaderComposition?.();

    try {
        const leaderText = document.getElementById('leaderInput')?.value || document.getElementById('leader-skill')?.innerText || "";
        const dbLeaderEl = document.getElementById('abs-leader-skill');
        if (dbLeaderEl) {
            const cleanLeader = leaderText.replace(/[\r\n]+/g, ' ').trim();
            dbLeaderEl.innerHTML = window.formatOfficialText ? window.formatOfficialText(cleanLeader, true) : (window.formatCategoryQuotes ? window.formatCategoryQuotes(cleanLeader) : cleanLeader);
        }
        window.syncAbsCleanLeaderBar?.();
    } catch(e) {}

    try {
        const activeRarity = window.getDisplayedCardRarity?.() || window.currentRarity || currentRarity;
        const activeAwakening = (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode && currentAwakeningMode !== 'none')
            ? currentAwakeningMode
            : ((window.currentAwakeningMode && window.currentAwakeningMode !== 'none') ? window.currentAwakeningMode : 'none');
        const useAbsClean = document.body.classList.contains('theme-abs-clean');
        
        const isLR = activeRarity === 'LR';
        const isSEZA = activeAwakening === 'seza';
        
        const lrThumb = document.getElementById('img-lr');
        const turThumb = document.getElementById('img-tur');
        const ssrThumb = document.getElementById('img-ssr');
        // Imported exchange forms retain their exact portrait here; the
        // progression thumbnails below intentionally still represent the base route.
        let thumbImg = window.currentCardThumbnail || '';
        if (!thumbImg && isLR) thumbImg = lrThumb ? lrThumb.src : '';
        else if (!thumbImg && activeRarity === 'TUR') thumbImg = turThumb ? turThumb.src : '';
        else if (!thumbImg && activeRarity === 'SSR') thumbImg = ssrThumb ? ssrThumb.src : '';
        else if (!thumbImg) thumbImg = (turThumb ? turThumb.src : '') || (ssrThumb ? ssrThumb.src : '') || (lrThumb ? lrThumb.src : '');
        window.syncAbsCleanAwakeningPortraits?.();
        
        const dbThumbImg = document.getElementById('abs-thumb-img');
        if (dbThumbImg && thumbImg) {
            // The SBA card grid uses the game's dedicated circle artwork. Use
            // that same official asset for the abs.clean header; custom cards
            // retain their own uploaded art because they do not have a game
            // circle file to resolve.
            let cleanPortraitUrl = '';
            if (useAbsClean && window.currentCardSource === 'official') {
                let portraitId = Number(window.currentOfficialCardId || 0);
                if (portraitId > 10000000) portraitId = Math.floor(portraitId / 10);
                const portraitFolderId = Math.floor(portraitId / 10) * 10;
                if (portraitFolderId > 0) {
                    cleanPortraitUrl = `./assets/card-art/cards/${portraitFolderId}/card_${portraitFolderId}_circle.png`;
                }
            }

            dbThumbImg.onerror = null;
            if (cleanPortraitUrl) {
                dbThumbImg.dataset.absCleanCirclePortrait = 'true';
                dbThumbImg.src = cleanPortraitUrl;
                dbThumbImg.onerror = function() {
                    // Some legacy cards have no exported circle art. Keep the
                    // circular layout, but safely fall back to their thumbnail.
                    this.onerror = null;
                    this.dataset.absCleanCirclePortrait = 'fallback';
                    this.src = thumbImg;
                };
            } else {
                delete dbThumbImg.dataset.absCleanCirclePortrait;
                dbThumbImg.src = thumbImg;
            }
        }

        const frameImg = document.querySelector('.card-frame');
        const dbFrameImg = document.getElementById('abs-frame-img');
        if (frameImg && dbFrameImg) dbFrameImg.src = frameImg.src;

        let absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_none.png';
        if (activeRarity === 'LR') absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_lr_abs.png';
        else if (activeRarity === 'TUR') absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png';
        else if (activeRarity !== 'none') absRarityImgSrc = 'https://abscustom.github.io/assets/images/rarity_ssr_abs.png';

        const dbTopRarity = document.getElementById('abs-top-rarity-icon');
        if (dbTopRarity) dbTopRarity.src = absRarityImgSrc;
        const cleanNameRarity = document.getElementById('abs-clean-name-rarity');
        if (cleanNameRarity) cleanNameRarity.src = absRarityImgSrc;
        
        const typeIcon = document.querySelector('.typing-icon');
        const dbTopType = document.getElementById('abs-top-type-icon');
        if (typeIcon && dbTopType) {
            dbTopType.src = typeIcon.src;
            const cleanNameType = document.getElementById('abs-clean-name-type');
            if (cleanNameType) cleanNameType.src = typeIcon.src;
            const parentComposed = dbTopType.closest('#abs-composed-icon') || dbTopType.parentElement;
            const useAbsCleanTypeGlow = useAbsClean;
            if (parentComposed) {
                // ABS Clean uses CSS for this badge treatment. Clear any
                // experimental LWF canvas that may still be mounted.
                parentComposed.querySelectorAll('.type-arrow-lwf-canvas').forEach(oldGlow => {
                    window.DokkanLWF?.destroy?.(oldGlow.id);
                    oldGlow.remove();
                });
                parentComposed.classList.remove('type-glow-ready');
                parentComposed.classList.remove('abs-clean-type-pulse');

                const headerLeft = parentComposed.closest('.abs-header-left');
                // The early two-icon colour test is superseded by the full
                // matchup strip below the unit name.
                headerLeft?.querySelector('#abs-clean-type-effect-preview')?.remove();
            }
        }

        const sbaHues = { agl: '165deg', teq: '75deg', int: '225deg', str: '310deg', phy: '0deg' };
        const sbaColors = { agl: '#00a2ff', teq: '#22c55e', int: '#a855f7', str: '#ef4444', phy: '#eab308' };
        const cardType = (window.currentType || (typeof currentType !== 'undefined' ? currentType : 'agl')).toLowerCase();

        const topLightning = document.getElementById('abs-lightning');
        const cleanLrAura = document.getElementById('abs-clean-lr-aura');
        const cleanLrLightning = document.getElementById('abs-clean-lr-lightning');
        const cleanRingEffect = document.getElementById('abs-clean-ring-effect');
        const topComposedIcon = document.getElementById('abs-composed-icon');

        if (useAbsClean) {
            const layoutContainer = document.getElementById('layout-abs-style');
            if (layoutContainer) {
                layoutContainer.style.setProperty('--abs-clean-ring-color', sbaColors[cardType] || '#38bdf8');
                layoutContainer.style.setProperty('--sba-lr-fx-hue', sbaHues[cardType] || '0deg');
            }
            window.startAbsCleanGridCircuit?.();

            if (topComposedIcon) {
                topComposedIcon.dataset.cardType = cardType;
                topComposedIcon.style.setProperty('--sba-lr-fx-hue', sbaHues[cardType] || '0deg');
                topComposedIcon.style.setProperty('--abs-clean-ring-color', sbaColors[cardType] || '#38bdf8');
                topComposedIcon.style.setProperty('--hub-ring-color', sbaColors[cardType] || '#ffaa00');
                topComposedIcon.classList.remove('seza-glow-card');

                const existingFlameCanvas = topComposedIcon.querySelector('.seza-lwf-border-canvas');
                if (existingFlameCanvas) {
                    window.DokkanLWF?.destroy?.(existingFlameCanvas.id);
                    existingFlameCanvas.remove();
                }
            }

            // In ABS Clean, hide legacy video lightning and dial
            if (topLightning) topLightning.style.setProperty('display', 'none', 'important');
            const spinDial = document.getElementById('abs-spin-dial');
            if (spinDial) spinDial.style.setProperty('display', 'none', 'important');

            // LR LWF aura & lightning
            if (isLR) {
                if (cleanLrAura) {
                    cleanLrAura.style.setProperty('display', 'block', 'important');
                    window.DokkanLWF?.attachDokkanModeLrEffect?.(cleanLrAura).catch?.(() => {});
                }
                if (cleanLrLightning) {
                    cleanLrLightning.style.setProperty('display', 'block', 'important');
                    window.DokkanLWF?.attachDokkanModeLrEffect?.(cleanLrLightning).catch?.(() => {});
                }
            } else {
                if (cleanLrAura) {
                    cleanLrAura.style.setProperty('display', 'none', 'important');
                    if (cleanLrAura.id) window.DokkanLWF?.pause?.(cleanLrAura.id);
                }
                if (cleanLrLightning) {
                    cleanLrLightning.style.setProperty('display', 'none', 'important');
                    if (cleanLrLightning.id) window.DokkanLWF?.pause?.(cleanLrLightning.id);
                }
            }

            // EZA & Super EZA electric rings
            const isEZA = activeAwakening === 'eza';
            if ((isSEZA || isEZA) && cleanRingEffect) {
                cleanRingEffect.style.setProperty('display', 'block', 'important');
                cleanRingEffect.classList.remove('sba-eza-ring-effect', 'sba-seza-ring-effect');
                cleanRingEffect.classList.add(isSEZA ? 'sba-seza-ring-effect' : 'sba-eza-ring-effect');
                cleanRingEffect.dataset.awakeningFx = isSEZA ? 'seza' : 'eza';
                window.scanSbaRingEffects?.();
            } else if (cleanRingEffect) {
                cleanRingEffect.style.setProperty('display', 'none', 'important');
                cleanRingEffect.classList.remove('sba-eza-ring-effect', 'sba-seza-ring-effect');
                cleanRingEffect.removeAttribute('data-awakening-fx');
            }
        } else {
            // Legacy ABS Style layout: ensure clean canvases are completely hidden
            if (cleanLrAura) cleanLrAura.style.setProperty('display', 'none', 'important');
            if (cleanLrLightning) cleanLrLightning.style.setProperty('display', 'none', 'important');
            if (cleanRingEffect) cleanRingEffect.style.setProperty('display', 'none', 'important');

            if (topLightning) {
                topLightning.style.setProperty('display', isLR ? 'block' : 'none', 'important');
                topLightning.style.setProperty('--lightning-color', isSEZA && !isLR ? 'rgb(255, 30, 80)' : (lightningColors[window.currentType || (typeof currentType !== 'undefined' ? currentType : 'agl')] || 'rgb(0, 150, 255)'));
            }

            const spinDial = document.getElementById('abs-spin-dial');
            if (spinDial) spinDial.style.setProperty('display', isLR ? 'block' : 'none', 'important');

            if (topComposedIcon) {
                topComposedIcon.classList.toggle('seza-glow-card', isSEZA);
                if (isSEZA && typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.attachSezaFlameBorder) {
                    window.DokkanLWF.attachSezaFlameBorder(topComposedIcon, cardType);
                } else {
                    const existingCanvas = topComposedIcon.querySelector('.seza-lwf-border-canvas');
                    if (existingCanvas) {
                        if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.destroy) {
                            window.DokkanLWF.destroy(existingCanvas.id);
                        }
                        existingCanvas.remove();
                    }
                }
            }
        }

        let absAwakeningSrc = null;
        if (activeAwakening === 'eza') absAwakeningSrc = 'https://abscustom.github.io/assets/images/eza_abs.png';
        if (activeAwakening === 'seza') absAwakeningSrc = 'https://abscustom.github.io/assets/images/superza_abs.png';

        const ezaContainer = document.getElementById('awakening-container');
        const dbEzaImg = document.getElementById('abs-awakening-img');
        const dbTopEzaImg = document.getElementById('abs-top-awakening-img');
        
        if (ezaContainer && ezaContainer.style.display !== 'none' && absAwakeningSrc) {
            if (dbEzaImg) { dbEzaImg.src = absAwakeningSrc; dbEzaImg.style.display = 'block'; }
            if (dbTopEzaImg) { dbTopEzaImg.src = absAwakeningSrc; dbTopEzaImg.style.display = 'block'; }
        } else {
            if (dbEzaImg) dbEzaImg.style.display = 'none';
            if (dbTopEzaImg) dbTopEzaImg.style.display = 'none';
        }

        const dbRarityIconRight = document.getElementById('abs-rarity-icon');
        if (dbRarityIconRight) dbRarityIconRight.src = absRarityImgSrc;
        
        const dbTypeIconRight = document.getElementById('abs-type-icon');
        if (typeIcon && dbTypeIconRight) dbTypeIconRight.src = typeIcon.src;
        
        const myOverlay = document.getElementById('myOverlayImage');
        const myOverlayVid = document.getElementById('myOverlayVideo');
        const dbArtImg = document.getElementById('abs-art-img');
        const dbArtVid = document.getElementById('abs-art-video');

        if (myOverlayVid && myOverlayVid.style.display !== 'none' && myOverlayVid.querySelector('source')?.src) {
            if (dbArtVid) {
                dbArtVid.src = myOverlayVid.querySelector('source').src;
                dbArtVid.style.display = 'block';
                dbArtVid.load();
                dbArtVid.play().catch(()=>{});
            }
            if (dbArtImg) dbArtImg.style.display = 'none';
        } else {
            if (dbArtVid) dbArtVid.style.display = 'none';
            if (myOverlay && dbArtImg) {
                dbArtImg.src = myOverlay.src;
                // Don't override display here since switchEditorArtMode will manage visibility between animated layers and flat image
            }
        }
        
        if (window.switchEditorArtMode) {
            const artMode = window.getAbsCleanArtMode?.(window.currentEditorArtMode || 'animated') || window.currentEditorArtMode || 'animated';
            window.switchEditorArtMode(artMode);
        }
    } catch(e) {}

    try {
        const passiveNameInput = document.getElementById('input-passive-name-sidebar');
        const passiveDisplay = document.querySelector('.passive-name-display');
        const passiveName = passiveNameInput?.value || passiveDisplay?.innerText || "Passive Skill";
        const safePassiveName = String(passiveName).replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[char]));
        
        const mainPassiveCont = document.getElementById('card-passive-container');
        const rawPassiveText = mainPassiveCont ? mainPassiveCont.innerText : "";
        // The editor textareas are the single source of truth for the summary.
        // Do not parse the rendered card markup, which can contain stale or
        // duplicated fragments while a theme/layout pass is in progress.
        window.syncAbsCleanPassiveSummary?.(window.getAbsCleanPassiveSource?.() || rawPassiveText);
        const iconsStripHtml = renderPassiveIconsStrip(rawPassiveText);
        const cleanPassiveIcons = document.getElementById('abs-clean-passive-icons');
        if (cleanPassiveIcons) {
            cleanPassiveIcons.innerHTML = isAbsCleanTheme ? iconsStripHtml : '';
            cleanPassiveIcons.hidden = !isAbsCleanTheme || !iconsStripHtml;
        }
        const cleanAbilityDocks = document.getElementById('abs-clean-ability-docks');
        if (cleanAbilityDocks) {
            cleanAbilityDocks.hidden = !isAbsCleanTheme || !iconsStripHtml;
        }

        const matchupStrip = document.getElementById('abs-clean-type-matchups');
        if (matchupStrip) {
            // Do not leave this strip inside the width-limited identity header.
            // As a direct child of the full ABS Clean layout, its absolute
            // viewport-based position can genuinely reach the far-right edge.
            const absLayout = document.getElementById('layout-abs-style');
            if (absLayout && matchupStrip.parentElement !== absLayout) {
                absLayout.appendChild(matchupStrip);
            }

            matchupStrip.querySelectorAll('canvas').forEach(c => {
                if (c.id && window.DokkanLWF?.destroy) {
                    window.DokkanLWF.destroy(c.id);
                }
            });

            const activeType = String(window.currentType || currentType || 'none').toLowerCase();
            const matchupMap = {
                agl: { strong: 'str', weak: 'teq' },
                teq: { strong: 'agl', weak: 'int' },
                int: { strong: 'teq', weak: 'phy' },
                str: { strong: 'phy', weak: 'agl' },
                phy: { strong: 'int', weak: 'str' }
            };
            const matchup = matchupMap[activeType];
            const activeClass = window.currentClass || currentClass || 'none';
            const typeSources = window.typeImageMap?.[activeClass] || window.typeImageUrls || {};
            const matchupEntries = matchup ? [
                { type: matchup.strong, state: 'is-strong', label: 'Super Effective' },
                { type: matchup.weak, state: 'is-weak', label: 'Not Effective' }
            ] : [];

            if (isAbsCleanTheme && matchup) {
                matchupStrip.innerHTML = matchupEntries.map(({ type, state, label }) => {
                    const src = typeSources[type] || window.typeImageUrls?.[type] || '';
                    const arrowClass = state === 'is-strong' ? 'arrow-up' : 'arrow-down';
                    return `<div class="abs-clean-matchup-row ${state}">
                        <span class="abs-clean-matchup-arrow ${arrowClass}"></span>
                        <span class="abs-clean-matchup-icon ${state}" title="${label}"><img src="${src}" alt="${type.toUpperCase()} — ${label}"><span>${label}</span></span>
                    </div>`;
                }).join('');
                matchupStrip.hidden = false;

                const mountArrows = () => {
                    if (!window.DokkanLWF?.attachTypeArrowEffect) {
                        window.scheduleEditorLwfHydration?.(150);
                        return;
                    }
                    const upSlot = matchupStrip.querySelector('.abs-clean-matchup-arrow.arrow-up');
                    const downSlot = matchupStrip.querySelector('.abs-clean-matchup-arrow.arrow-down');
                    if (upSlot) {
                        window.DokkanLWF.attachTypeArrowEffect(upSlot, activeType, true, {
                            movie: 'ef_001',
                            scale: 15,
                            layer: 'arrow_up',
                            playbackRate: 0.5 // Arrow animation speed: 1.0 = normal, 0.5 = 50% speed (slower)
                        });
                    }
                    if (downSlot) {
                        window.DokkanLWF.attachTypeArrowEffect(downSlot, activeType, false, {
                            movie: 'ef_002',
                            scale: 15,
                            layer: 'arrow_down',
                            playbackRate: 0.5 // Arrow animation speed: 1.0 = normal, 0.5 = 50% speed (slower)
                        });
                    }
                };
                mountArrows();
            } else {
                matchupStrip.innerHTML = '';
                matchupStrip.hidden = true;
            }
        }

        window.syncAbsCleanIdentityIcons?.();
        window.syncAbsCleanInfoBar?.();

        const dbPassiveName = document.getElementById('abs-passive-name');
        if (dbPassiveName) {
            const cleanPassiveBox = document.getElementById('abs-passive-skill-box');
            // Both live panels are direct children of this header in clean
            // mode. Park them in the surrounding box before rebuilding its
            // title so innerHTML cannot discard their render state.
            [abilityDocks, passiveSummary]
                .filter(node => node?.parentElement === dbPassiveName)
                .forEach(node => {
                    if (cleanPassiveBox && !node.contains(cleanPassiveBox)) cleanPassiveBox.appendChild(node);
                    else node.remove();
                });

            dbPassiveName.innerHTML = isAbsCleanTheme
                ? `<div class="abs-passive-external-header"><span class="abs-passive-external-label">Passive Skill</span></div>`
                : `<div class="abs-passive-header-title">
                    <span>Passive Skill</span>
                    <span class="mx-1">&ndash;</span>
                    <i>${safePassiveName}</i>
                </div>`;
            window.syncAbsCleanAbilityDockPlacement?.();
        }
        
        const dbPassiveCont = document.getElementById('abs-passive-container');
        if (dbPassiveCont && mainPassiveCont) {
            let passiveHtml = mainPassiveCont.innerHTML || "";
            if (window.normalizeAssetUrl) passiveHtml = window.normalizeAssetUrl(passiveHtml);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = passiveHtml;

            let formattedHtml = "";
            const sections = tempDiv.querySelectorAll('strong');
            if (sections.length > 0) {
                sections.forEach((st, idx) => {
                    const titleText = st.innerText.trim();
                    const mt = (idx === 0 || formattedHtml === "") ? "margin-top: 0;" : "margin-top: 14px;";
                    formattedHtml += `<strong class="abs-passive-section-title" style="display:block; ${mt} margin-bottom: 4px; color:var(--theme-text, #38bdf8); font-size: 13.5px; text-shadow: 0 0 8px var(--theme-glow, rgba(56, 189, 248, 0.6)); font-weight: 700;">${window.formatCategoryQuotes ? window.formatCategoryQuotes(titleText) : titleText}</strong>`;
                    
                    let sib = st.nextElementSibling;
                    while (sib && sib.tagName !== 'STRONG') {
                        if (sib.tagName === 'UL') {
                            formattedHtml += '<ul class="abs-passive-list">';
                            sib.querySelectorAll('li').forEach(li => {
                                let liContent = li.innerHTML;
                                if (window.formatOfficialText) liContent = window.formatOfficialText(liContent, false);
                                else if (window.formatCategoryQuotes) liContent = window.formatCategoryQuotes(liContent);
                                formattedHtml += `<li>${liContent}</li>`;
                            });
                            formattedHtml += '</ul>';
                        }
                        sib = sib.nextElementSibling;
                    }
                });
            } else {
                formattedHtml = tempDiv.innerHTML;
                if (window.formatOfficialText) formattedHtml = window.formatOfficialText(formattedHtml, false);
                else if (window.formatCategoryQuotes) formattedHtml = window.formatCategoryQuotes(formattedHtml);
            }

            dbPassiveCont.innerHTML = isAbsCleanTheme
                ? `<div class="abs-passive-name-inside">${safePassiveName}</div>${formattedHtml}`
                : formattedHtml;
        }
    } catch(e) {}

    try {
        if (window.updateAbsStyleSuperAttacks) window.updateAbsStyleSuperAttacks();
    } catch(e) {}

    try {
        if (window.updateAbsStyleActiveSkills) window.updateAbsStyleActiveSkills();
    } catch(e) {}

    try {
        const dbLinkCont = document.getElementById('abs-link-container');
        if (dbLinkCont) {
            dbLinkCont.innerHTML = "";
            const linkEntries = Array.from(document.querySelectorAll('#card-link-container a'))
                .map((a, sourceIndex) => ({
                    anchor: a,
                    linkName: a.innerText.trim(),
                    sourceIndex
                }))
                .filter(({ linkName }) => Boolean(linkName));
            linkEntries.sort((a, b) => {
                const lengthDiff = a.linkName.length - b.linkName.length;
                return lengthDiff !== 0 ? lengthDiff : a.sourceIndex - b.sourceIndex;
            });
            linkEntries.forEach(({ anchor: a, linkName }) => {
                if (linkName) {
                    const level10Effect = window.getLinkSkillLevel10Description?.(linkName) || '';
                    const tooltip = window.escapeLinkTooltipAttribute?.(level10Effect) || level10Effect;
                    const tooltipAttr = level10Effect ? ` data-tooltip="${tooltip}"` : '';
                    if (level10Effect) a.setAttribute('data-tooltip', level10Effect);
                    else a.removeAttribute('data-tooltip');
                    const effectHtml = level10Effect ? `<div class="abs-link-effect">${tooltip}</div>` : '';
                    const safeLinkName = window.escapeLinkTooltipAttribute?.(linkName) || linkName;
                    const linkObj = Object.values(window.DB?.links || {}).find(link => link?.name === linkName);
                    dbLinkCont.insertAdjacentHTML('beforeend', `
                    <div class="abs-link-badge"${tooltipAttr}>
                        <div class="abs-link-lv">
                            <span class="lv-text">Lv</span>
                            <span class="num-text">10</span>
                        </div>
                        <div class="abs-link-name">${safeLinkName}</div>
                        ${effectHtml}
                    </div>`);
                }
            });
        }
    } catch(e) {}

    try {
        const dbCatCont = document.getElementById('abs-category-container');
        if (dbCatCont) {
            ensureAbsCleanCategoryCountDatabase();
            // Clear every previous render first. This removes the static
            // placeholder rows before imported categories are bound.
            dbCatCont.replaceChildren();
            const sourceContainer = document.getElementById('card-category-container');
            window.normalizeEditorCategoryItems?.(sourceContainer);
            const itemsToRender = window.getEditorCategoryItems
                ? window.getEditorCategoryItems(sourceContainer)
                : Array.from(sourceContainer?.children || []);
            // Display categories shortest-to-longest; source order remains unchanged for editing/export.
            const catEntries = Array.from(itemsToRender).map(item => {
                const resolved = window.resolveDokkanCategoryDisplay?.(item) || {};
                const img = item.querySelector?.('img');
                const source = resolved.source || img?.currentSrc || img?.src || '';
                const categoryId = resolved.id || '';
                const categoryName = resolved.name || '';
                if (!categoryName) return null;
                const catColor = window.getDokkanCategoryColor?.(categoryName) || '#38bdf8';
                const categoryCount = window.getDokkanCategoryCharacterCount?.(categoryId, categoryName) ?? 0;
                return { categoryId, categoryName, source, catColor, categoryCount };
            }).filter(Boolean);
            catEntries.sort((a, b) => {
                const lengthDiff = String(a.categoryName || '').trim().length - String(b.categoryName || '').trim().length;
                if (lengthDiff !== 0) return lengthDiff;
                if (window.compareDokkanCategoryColors) return window.compareDokkanCategoryColors(a.catColor, a.categoryName, b.catColor, b.categoryName);
                if (a.catColor < b.catColor) return -1;
                if (a.catColor > b.catColor) return 1;
                return String(a.categoryName).localeCompare(String(b.categoryName));
            });
            catEntries.forEach(({ categoryId, categoryName, source, catColor, categoryCount }) => {
                const safeCatName = window.escapeLinkTooltipAttribute?.(categoryName) || categoryName;
                const safeSource = window.escapeLinkTooltipAttribute?.(source) || source;
                const categoryIdAttr = categoryId ? ` data-category-id="${categoryId}"` : '';
                dbCatCont.insertAdjacentHTML('beforeend', `
                    <span class="abs-category-entry"${categoryIdAttr}>
                        <img src="${safeSource}" alt="${safeCatName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                        <span class="abs-category-badge" data-category="${safeCatName}" style="--cat-color: ${catColor};">
                            <span class="abs-category-dot"></span>
                            <span class="abs-category-name">${safeCatName}</span>
                            <span class="abs-category-count" aria-label="${categoryCount} characters">
                                <span class="abs-category-count-label">SUM</span>
                                <span class="abs-category-count-value">${categoryCount}</span>
                            </span>
                        </span>
                        <span class="category-name-fallback" style="display:none;">${safeCatName}</span>
                    </span>
                `);
            });
            // Placement must run after categories render (box may be recreated).
            window.syncAbsCleanLinkSkillsPlacement?.();
            window.syncAbsCleanRightRail?.();
        }
    } catch(e) {}

    try {
        if (window.updateAbsStatDisplay) window.updateAbsStatDisplay();
    } catch(e) {}

    try {
        const baseDate = (document.getElementById('dateInput')?.value?.trim() || "") || "TBD";
        const ezaDate = (document.getElementById('ezaDateInput')?.value?.trim() || "") || "TBD";
        const sezaDate = (document.getElementById('sezaDateInput')?.value?.trim() || "") || "TBD";
        
        const activeType = window.currentType || currentType;
        const activeClass = window.currentClass || currentClass;
        const activeRarity = window.getDisplayedCardRarity?.() || window.currentRarity || currentRarity;
        const activeAwakening = (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode && currentAwakeningMode !== 'none')
            ? currentAwakeningMode
            : ((window.currentAwakeningMode && window.currentAwakeningMode !== 'none') ? window.currentAwakeningMode : 'none');
        
        const baseTypeSrc = typeImageUrls[activeType] || "https://abscustom.github.io/assets/images/type_none.png";
        const classTypeSrc = typeImageMap[activeClass]?.[activeType] || baseTypeSrc;
        const frameSrc = document.getElementById('abs-frame-img')?.src || "https://abscustom.github.io/assets/images/frame_none.png";

        const buildDbCardIcon = (thumbSrc, raritySrc, usePlainType = false, ezaIconSrc = null, isSEZA = false, extraClass = '') => {
            const tSrc = usePlainType ? baseTypeSrc : classTypeSrc;
            const isLR = raritySrc.includes('rarity_lr');
            const isCleanForm = Boolean(extraClass && extraClass.includes('abs-clean-form-icon'));
            const showLightning = !isCleanForm && (isLR || isSEZA);
            const sezaLightningStyle = isSEZA && !isLR ? 'style="--lightning-color: rgb(255, 30, 80);"' : '';
            const lrSpinHtml = (!isCleanForm && isLR) ? `<img src="https://abscustom.github.io/assets/images/lr_spin_dial.png" class="lr-spin-dial">` : '';
            const lrLightningHtml = showLightning ? `
                <video class="lightning-overlay" autoplay muted loop playsinline ${sezaLightningStyle}>
                    <source src="https://abscustom.github.io/assets/images/lightningfx.webm" type="video/webm">
                </video>` : '';
            const ezaHtml = ezaIconSrc ? `<img src="${ezaIconSrc}" class="eza-icon">` : '';
            const sezaGlowClass = isSEZA ? 'seza-glow-card' : '';

            const iconClassName = ['abs-composed-icon', sezaGlowClass, extraClass]
                .filter(Boolean)
                .join(' ');

            return `
                <div class="${iconClassName}" data-card-type="${activeType}">
                    <img class="card-frame" src="${frameSrc}">
                    ${lrSpinHtml}
                    ${lrLightningHtml}
                    <div class="thumb-box">
                        <img class="thumb-img" src="${thumbSrc}">
                    </div>
                    <img class="rarity-icon" src="${raritySrc}">
                    <img class="type-icon" src="${tSrc}">
                    ${ezaHtml}
                </div>
            `;
        };

        const awakenCont = document.getElementById('abs-awakenings-container');
        if (awakenCont) {
            let awHTML = '';
            const buildStepDivider = (imgSrc, fallbackText) => {
                if (document.body.classList.contains('theme-abs-clean')) {
                    return '<div class="abs-awaken-divider"></div>';
                }
                return `
                    <div class="abs-awaken-divider">
                        <img src="${imgSrc}" onerror="this.outerHTML='<span class=\\'abs-awaken-divider-text\\'>${fallbackText}</span>'">
                    </div>
                `;
            };

            const ssrSrc = document.getElementById('img-ssr')?.getAttribute('src') || document.getElementById('img-ssr')?.src || "";
            const turSrc = document.getElementById('img-tur')?.getAttribute('src') || document.getElementById('img-tur')?.src || "";
            const lrSrc = document.getElementById('img-lr')?.getAttribute('src') || document.getElementById('img-lr')?.src || "";
            const mainThumbSrc = document.getElementById('abs-thumb-img')?.getAttribute('src') || document.getElementById('abs-thumb-img')?.src || lrSrc || turSrc || ssrSrc || "https://abscustom.github.io/assets/images/default.png";
            const ssrRaritySrc = "https://abscustom.github.io/assets/images/rarity_ssr_abs.png";
            const turRaritySrc = "https://abscustom.github.io/assets/images/rarity_TUR_abs.png";
            const lrRaritySrc = "https://abscustom.github.io/assets/images/rarity_lr_abs.png";
            const currentRaritySrc = activeRarity === 'LR'
                ? lrRaritySrc
                : (activeRarity === 'TUR'
                    ? turRaritySrc
                    : (activeRarity === 'SSR' ? ssrRaritySrc : "https://abscustom.github.io/assets/images/rarity_none.png"));
            const ezaIconSrc = activeAwakening === 'seza'
                ? "https://abscustom.github.io/assets/images/superza_abs.png"
                : (activeAwakening === 'eza' ? "https://abscustom.github.io/assets/images/eza_abs.png" : null);

            const hasCustomSsr = ssrSrc && !ssrSrc.endsWith('SSR_Icon.png') && !ssrSrc.endsWith('none.png') && !ssrSrc.endsWith('default.png') && !ssrSrc.endsWith('editor.html');
            const hasCustomTur = turSrc && !turSrc.endsWith('TUR_Icon.png') && !turSrc.endsWith('none.png') && !turSrc.endsWith('default.png') && !turSrc.endsWith('editor.html');

            const hasAwakeningProgression = activeRarity !== 'none' && activeRarity !== 'SSR' && (hasCustomSsr || hasCustomTur || (activeRarity === 'LR' && (hasCustomSsr || hasCustomTur)));

            const isClean = document.body.classList.contains('theme-abs-clean');
            const dateMarkup = (label, dt) => isClean
                ? ''
                : `<div class="abs-awaken-date" style="font-size: 14px; font-weight: bold; text-align: center; flex: 1;">
                    ${label}<br>
                    <span style="color: #a1a1aa; font-weight: normal; font-size: 12px;">${dt}</span>
                </div>`;

            if (!hasAwakeningProgression || activeRarity === 'none') {
                // SINGLE ICON MODE: Standalone card (battlefield unit, skin, event card, single form)
                const isSEZA = activeAwakening === 'seza';

                awHTML += `
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(mainThumbSrc, currentRaritySrc, false, ezaIconSrc, isSEZA)}
                        ${dateMarkup('Release Date:', baseDate)}
                    </div>
                `;

                if (activeAwakening === 'eza' || isSEZA) {
                    if (ezaDate && ezaDate !== "TBD" && ezaDate !== baseDate) {
                        awHTML += `
                            ${buildStepDivider(isSEZA ? 'https://abscustom.github.io/assets/images/superza_abs.png' : 'https://abscustom.github.io/assets/images/eza_abs.png', isSEZA ? 'SUPER EZA' : 'EXTREME Z-AWAKEN')}
                            <div class="abs-awaken-row">
                                ${buildDbCardIcon(mainThumbSrc, currentRaritySrc, false, ezaIconSrc, isSEZA)}
                                ${dateMarkup((isSEZA ? 'SEZA' : 'EZA') + ' Release Date:', isSEZA ? sezaDate : ezaDate)}
                            </div>
                        `;
                    }
                }
            } else {
                // MULTI-STAGE AWAKENING PROGRESSION (SSR -> TUR -> LR)
                const safeSsrSrc = ssrSrc || "https://abscustom.github.io/assets/images/SSR_Icon.png";
                awHTML += `
                    <div class="abs-awaken-row">
                        ${buildDbCardIcon(safeSsrSrc, ssrRaritySrc, true)}
                        ${dateMarkup('Release Date:', baseDate)}
                    </div>
                `;
                
                if (activeRarity === 'TUR' || activeRarity === 'LR') {
                    const safeTurSrc = turSrc || "https://abscustom.github.io/assets/images/TUR_Icon.png";
                    awHTML += `
                        ${buildStepDivider(activeRarity === 'TUR' || !hasCustomSsr
                            ? 'https://abscustom.github.io/assets/images/dokkan-awaken.png'
                            : 'https://abscustom.github.io/assets/images/z-awaken.png', activeRarity === 'TUR' || !hasCustomSsr ? 'DOKKAN AWAKEN' : 'Z-AWAKEN')}
                        <div class="abs-awaken-row">
                        ${buildDbCardIcon(safeTurSrc, turRaritySrc, false)}
                            ${dateMarkup('Release Date:', baseDate)}
                        </div>
                    `;
                }

                if (activeRarity === 'LR') {
                    const safeLrSrc = lrSrc || "https://abscustom.github.io/assets/images/LR_Icon.png";
                    awHTML += `
                        ${buildStepDivider('https://abscustom.github.io/assets/images/dokkan-awaken.png', 'LEGENDARY AWAKEN')}
                        <div class="abs-awaken-row">
                        ${buildDbCardIcon(safeLrSrc, lrRaritySrc, false)}
                            ${dateMarkup('Release Date:', baseDate)}
                        </div>
                    `;
                }

                if (activeAwakening === 'eza' || activeAwakening === 'seza') {
                    const maxThumb = activeRarity === 'LR' ? (safeLrSrc) : (safeTurSrc);
                    const maxRar = activeRarity === 'LR' ? 'LR' : 'TUR';
                    awHTML += `
                        ${buildStepDivider('https://abscustom.github.io/assets/images/eza_abs.png', 'EXTREME Z-AWAKEN')}
                        <div class="abs-awaken-row">
                            ${buildDbCardIcon(maxThumb, maxRar === 'LR' ? lrRaritySrc : turRaritySrc, false, 'https://abscustom.github.io/assets/images/eza_abs.png')}
                            ${dateMarkup('EZA Release Date:', ezaDate)}
                        </div>
                    `;
                }

                if (activeAwakening === 'seza') {
                    const maxThumb = activeRarity === 'LR' ? (safeLrSrc) : (safeTurSrc);
                    const maxRar = activeRarity === 'LR' ? 'LR' : 'TUR';
                    awHTML += `
                        ${buildStepDivider('https://abscustom.github.io/assets/images/superza_abs.png', 'SUPER EZA')}
                        <div class="abs-awaken-row">
                            ${buildDbCardIcon(maxThumb, maxRar === 'LR' ? lrRaritySrc : turRaritySrc, false, 'https://abscustom.github.io/assets/images/superza_abs.png', true)}
                            ${dateMarkup('SEZA Release Date:', sezaDate)}
                        </div>
                    `;
                }
            }

            awakenCont.innerHTML = awHTML;

            // The SSR/TUR switches apply to the ABS progression as well.  Remove
            // the matching complete row (and its now-orphaned divider) so no
            // empty space or floating awaken arrow is left behind.
            const removeAwakeningStage = (rarityKey) => {
                awakenCont.querySelectorAll(`.abs-awaken-row:has(.rarity-icon[src*="${rarityKey}"])`).forEach(row => {
                    const previous = row.previousElementSibling;
                    row.remove();
                    if (previous?.classList.contains('abs-awaken-divider')) previous.remove();
                });
            };
            if (window.showSsrProgression === false) removeAwakeningStage('rarity_ssr_abs');
            if (window.showTurProgression === false) removeAwakeningStage('rarity_TUR_abs');

            awakenCont.querySelectorAll('.abs-awaken-divider').forEach(divider => {
                if (!divider.previousElementSibling?.matches('.abs-awaken-row') || !divider.nextElementSibling?.matches('.abs-awaken-row')) {
                    divider.remove();
                }
            });
            const awakeningsBox = document.getElementById('abs-awakenings-box');
            if (!isClean) {
                // In abs.style, the awakenings box is always displayed with the character's release date
                if (awakeningsBox) {
                    awakeningsBox.style.display = '';
                    awakeningsBox.classList.remove('d-none');
                }
            } else {
                // In abs.clean, the native awakenings box is hidden (content moved to clean dock)
                if (awakeningsBox) awakeningsBox.style.display = 'none';
            }

            if (typeof window.DokkanLWF !== 'undefined' && window.DokkanLWF.attachSezaFlameBorder) {
                awakenCont.querySelectorAll('.abs-composed-icon[data-seza="true"], .abs-composed-icon.seza-glow-card').forEach(iconEl => {
                    const cardType = (window.currentType || currentType || 'agl').toLowerCase();
                    window.DokkanLWF.attachSezaFlameBorder(iconEl, cardType);
                });
            }
        }

        const transBox = document.getElementById('abs-transformations-box');
        const transCont = document.getElementById('abs-transformations-container');
        const forms = document.querySelectorAll('#forms-container .dokkan-card');

        if (transBox && transCont) {
            const activeForm = window.selectedForm || (typeof selectedForm !== 'undefined' ? selectedForm : null);
            const activeFormIsInList = Boolean(activeForm && Array.from(forms).includes(activeForm));
            const currentThumbElement = document.getElementById('abs-thumb-img');
            const currentRaritySrc = activeRarity === 'LR'
                ? 'https://abscustom.github.io/assets/images/rarity_lr_abs.png'
                : (activeRarity === 'TUR'
                    ? 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png'
                    : 'https://abscustom.github.io/assets/images/rarity_ssr_abs.png');
            const currentStageId = activeRarity === 'LR' ? 'img-lr' : (activeRarity === 'TUR' ? 'img-tur' : 'img-ssr');
            const readImageSource = element => element?.getAttribute('src')
                || element?.src
                || element?.currentSrc
                || '';
            const normalizeImageSource = source => String(source || '')
                .trim()
                .split(/[?#]/, 1)[0]
                .replace(/\\/g, '/')
                .toLowerCase();
            const isNonPortraitFormSource = source => {
                const value = normalizeImageSource(source);
                if (!value || value === 'about:blank') return true;
                return /(?:^|[\\/_-])(?:sp_)?cutin(?:[_./?]|$)/i.test(value)
                    || /form[_-]?cutin/i.test(value)
                    || /(?:^|[\\/_-])default(?:[_./?]|$)/i.test(value)
                    || value.includes('card art template');
            };
            const currentFormSourceCandidates = [
                readImageSource(currentThumbElement),
                readImageSource(document.getElementById(currentStageId)),
                readImageSource(document.getElementById('img-lr')),
                readImageSource(document.getElementById('img-tur')),
                readImageSource(document.getElementById('img-ssr'))
            ];
            const currentFormImg = currentFormSourceCandidates.find(source => !isNonPortraitFormSource(source))
                || currentFormSourceCandidates.find(Boolean)
                || 'https://abscustom.github.io/assets/images/default.png';

            /* Legacy Forms stores the wide cut-in in `.form-image` and may
               also copy that same URL into `data-thumb-src`. The clean Forms
               rail must use a real portrait thumbnail when one exists, and
               fall back to the current card portrait instead of displaying a
               wide cut-in inside the circle. */
            const getFormPortraitSource = form => {
                const formImage = form?.querySelector('.form-image');
                const declaredThumb = form?.getAttribute('data-thumb-src') || '';
                const formImageSource = readImageSource(formImage);
                const formImageExportName = formImage?.getAttribute('data-export-name') || '';
                const thumbMatchesWideImage = Boolean(
                    normalizeImageSource(declaredThumb)
                    && normalizeImageSource(declaredThumb) === normalizeImageSource(formImageSource)
                );
                const formImageIsCutin = isNonPortraitFormSource(formImageSource)
                    || /cutin/i.test(formImageExportName);
                const thumbIsCutinFallback = thumbMatchesWideImage && formImageIsCutin;
                if (declaredThumb && !isNonPortraitFormSource(declaredThumb) && !thumbIsCutinFallback) {
                    return declaredThumb;
                }

                const explicitPortrait = form?.querySelector(
                    '[data-form-thumb], [data-abs-clean-portrait-src], .form-thumb, .form-thumbnail'
                );
                const explicitPortraitSource = readImageSource(explicitPortrait);
                if (explicitPortraitSource && !isNonPortraitFormSource(explicitPortraitSource)) {
                    return explicitPortraitSource;
                }
                return currentFormImg;
            };
            const currentFormName = document.getElementById('nameInput')?.value?.trim()
                || document.getElementById('abs-char-name')?.textContent?.trim()
                || 'Current Form';
            const renderCurrentForm = isAbsCleanTheme;

            if (forms.length > 0 || renderCurrentForm) {
                if (forms.length > 0) transBox.classList.remove('d-none');
                let trHTML = '';

                if (renderCurrentForm) {
                    const rawCurrentTitle = document.getElementById('descInput')?.value?.trim()
                        || document.getElementById('abs-char-title')?.textContent?.trim()
                        || '';
                    const cleanCurrentTitle = rawCurrentTitle.replace(/[\[\]]/g, '').trim();
                    const currentFormDisplayName = (cleanCurrentTitle && !currentFormName.startsWith('['))
                        ? `[${cleanCurrentTitle}] ${currentFormName}`
                        : currentFormName;
                    const safeCurrentTooltip = window.escapeLinkTooltipAttribute?.(currentFormDisplayName)
                        || String(currentFormDisplayName).replace(/"/g, '&quot;');
                    const currentTooltipAttr = isAbsCleanTheme ? ` data-tooltip="${safeCurrentTooltip}"` : '';

                    trHTML += `
                        <div class="abs-transform-row abs-clean-current-form${activeFormIsInList ? '' : ' is-active'}" data-form-index="current" data-edit="forms"${currentTooltipAttr}>
                            <a href="javascript:void(0)" class="abs-transform-link abs-clean-current-form-link" style="text-decoration:none; color:inherit; display:flex; align-items:center; width:100%;">
                                ${buildDbCardIcon(currentFormImg, currentRaritySrc, false, null, false, isAbsCleanTheme ? 'abs-clean-form-icon' : '')}
                                <div class="abs-transform-name" style="flex: 1; text-align: center; font-size: 15px; font-weight: bold;">${currentFormName}</div>
                            </a>
                        </div>
                    `;
                }

                forms.forEach((f, formIndex) => {
                    const fImg = getFormPortraitSource(f);
                    const fName = f.querySelector('.form-name-display')?.innerText || f.querySelector('.form-name')?.innerText || "Form";
                    const safeFormTooltip = window.escapeLinkTooltipAttribute?.(fName)
                        || String(fName).replace(/"/g, '&quot;');
                    const formTooltipAttr = isAbsCleanTheme ? ` data-tooltip="${safeFormTooltip}"` : '';
                    const fLinkAnchor = f.querySelector('.form-link');
                    let fLink = fLinkAnchor ? fLinkAnchor.getAttribute('href') : "javascript:void(0)";
                    if (!fLink || fLink === "#") fLink = "javascript:void(0)";
                    const isActiveForm = f === activeForm;

                    if (trHTML !== '') {
                        trHTML += `<div class="abs-transform-divider"></div>`;
                    }

                    trHTML += `
                        <div class="abs-transform-row${isActiveForm ? ' is-active' : ''}" data-form-index="${formIndex}"${formTooltipAttr}>
                            <a href="${fLink}" class="abs-transform-link" target="_blank" style="text-decoration:none; color:inherit; display:flex; align-items:center; width:100%;">
                                ${buildDbCardIcon(fImg, activeRarity === 'LR' ? 'https://abscustom.github.io/assets/images/rarity_lr_abs.png' : 'https://abscustom.github.io/assets/images/rarity_TUR_abs.png', false, null, false, isAbsCleanTheme ? 'abs-clean-form-icon' : '')}
                                <div class="abs-transform-name" style="flex: 1; text-align: center; font-size: 15px; font-weight: bold;">${fName}</div>
                            </a>
                        </div>
                    `;
                });
                transCont.innerHTML = trHTML;
                window.syncAbsCleanHeaderComposition?.();
            } else {
                transBox.classList.add('d-none');
                transCont.innerHTML = '';
                window.syncAbsCleanHeaderComposition?.();
            }
        }
    } catch(e) { console.error("Awakenings/Transformations Sync Error", e); }

    window.syncAbsCleanAwakeningFormsPlacement?.();
    window.syncAbsCleanLinkPartnersPlacement?.();
    window.syncAbsCleanAbilityDockPlacement?.();
    window.syncAbsCleanStatsAndArtPlacement?.();

    try {
        if (window.renderPassiveHeaderBadgeToggles) window.renderPassiveHeaderBadgeToggles();
    } catch(e) {}

    try {
        if (window.syncAbsCleanReleaseDate) window.syncAbsCleanReleaseDate();
    } catch(e) {}
};

function getAbsStatIconPath(iconPath) {
    if (!iconPath) return 'https://abscustom.github.io/assets/images/st_0001.png';
    if (iconPath.includes('pot_skill_02_on.png')) {
        return 'https://abscustom.github.io/assets/images/st_critical_up.png';
    }
    return iconPath;
}

function getStatsFromBlock(block) {
    const stats = [];
    const statContainer = block.querySelector('.stats-container');
    if (!statContainer) return stats;

    const statRows = statContainer.querySelectorAll('.sa-stat-row, .col, div');
    const elementsToScan = statRows.length > 0 ? statRows : statContainer.children;
    const effectsText = block.querySelector('.sa-display-effects-list')?.innerText || '';

    const isSelfExcluded = /self excluded|excluding self|self-excluded/i.test(effectsText);
    const clauses = effectsText.split(/,|\;|\band\s+(?=causes|lowers|greatly|massively|seals|stuns|disables|raises)/i);

    const jointAndTurnMatch = effectsText.match(/(ATK|DEF)\b[^\;\,\.]*?\band\b[^\;\,\.]*?\bfor\s+(\d+)\s+turns?/i);
    let jointTurns = null;
    if (jointAndTurnMatch) {
        const num = parseInt(jointAndTurnMatch[2], 10);
        jointTurns = `${num} turn${num > 1 ? 's' : ''}`;
    }

    const assignedTargets = new Set();

    Array.from(elementsToScan).forEach(row => {
        const img = row.tagName === 'IMG' ? row : row.querySelector('img');
        if (!img) return;

        const iconSrc = img.getAttribute('src');
        if (!iconSrc || iconSrc.includes('sp_skill_icon')) return;

        let value = '';
        const textEl = row.querySelector('.display-text, span') || row;
        const rawText = textEl ? textEl.textContent : '';
        const valMatch = rawText.match(/(\d+)\s*%/);
        if (valMatch) value = valMatch[1];

        let target = row.dataset.target;
        if (!target) {
            const isEnemyIcon = 
                iconSrc.includes('st_0011') || iconSrc.includes('st_0012') || 
                iconSrc.includes('st_1009') || iconSrc.includes('st_0100') || iconSrc.includes('st_0102');   

            if (isEnemyIcon || /enemy|debuff|lower|seal|stun|break|disable/i.test(rawText)) target = 'enemy';
            else if (/ally|allies/i.test(rawText)) target = 'ally';
            else if (isSelfExcluded && /ally|allies|team|party/i.test(effectsText)) target = 'ally';
            else target = 'self';
        }
        
        assignedTargets.add(`${iconSrc}-${target}`);

        let turns = row.dataset.turns;
        if (!turns) {
            let isAttackBreak = iconSrc.includes('st_1009') || /disable|break/i.test(rawText);
            let isStunOrSeal = iconSrc.includes('st_0100') || iconSrc.includes('st_0102') || /stun|seal/i.test(rawText);
            let isLowerStat = iconSrc.includes('st_0011') || iconSrc.includes('st_0012') || /lower/i.test(rawText);

            if (isAttackBreak) turns = '1 turn';
            else if (isStunOrSeal) turns = '2 turns';
            else if (isLowerStat) turns = '3 turns';
            else if (/raise|raises|boost/i.test(effectsText) && !/for\s+\d+\s+turn/i.test(effectsText)) turns = '99 turns';
            else turns = '1 turn';
        }

        stats.push({ icon: iconSrc, value: value, turns: turns, target: target });
    });

    const uniqueStats = [];
    const seen = new Set();
    stats.forEach(s => {
        const key = `${s.icon}-${s.value}-${s.target}-${s.turns}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueStats.push(s);
        }
    });

    return uniqueStats;
}

function renderAbsSpecialEffects(stats) {
    if (!stats || stats.length === 0) return '';
    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');

    const selfStats = stats.filter(s => s.target === 'self');
    const allyStats = stats.filter(s => s.target === 'ally' || s.target === 'allies');
    const enemyStats = stats.filter(s => s.target === 'enemy');

    const getFloatingTagSvg = (typeClass) => {
        if (isAbsCleanTheme) {
            return '';
        }
        if (typeClass === 'allies') {
            return `
                <div class="abs-floating-target-tag allies" title="Allies (+)">
                    <svg class="abs-target-svg allies" viewBox="0 0 34 24" width="24" height="15" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 21v-1c0-1.8 1.3-3.2 3-3.4" stroke-width="1.8" opacity="0.75" />
                        <circle cx="5" cy="11" r="2.2" stroke-width="1.8" opacity="0.75" />
                        <path d="M17 16.6c1.7.2 3 1.6 3 3.4v1" stroke-width="1.8" opacity="0.75" />
                        <circle cx="17" cy="11" r="2.2" stroke-width="1.8" opacity="0.75" />
                        <path d="M6 21v-1c0-2.2 1.8-4 4-4h2c2.2 0 4 1.8 4 4v1" stroke-width="2" />
                        <circle cx="11" cy="10" r="2.8" stroke-width="2" />
                        <path d="M24 6h6" stroke-width="2.5" />
                        <path d="M27 3v6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        } else if (typeClass === 'enemy') {
            return `
                <div class="abs-floating-target-tag enemy" title="Enemy (-)">
                    <svg class="abs-target-svg enemy" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 21v-1c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v1" stroke-width="2" />
                        <circle cx="9" cy="10" r="3" stroke-width="2" />
                        <path d="M16 6h6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        } else {
            return `
                <div class="abs-floating-target-tag self" title="Self (+)">
                    <svg class="abs-target-svg self" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 21v-1c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v1" stroke-width="2" />
                        <circle cx="9" cy="10" r="3" stroke-width="2" />
                        <path d="M16 6h6" stroke-width="2.5" />
                        <path d="M19 3v6" stroke-width="2.5" />
                    </svg>
                </div>
            `;
        }
    };

    const renderGroup = (typeClass, statList) => {
        if (statList.length === 0) return '';
        const isNegative = typeClass === 'enemy';
        const tooltipTitle = isNegative ? 'Target: Enemy (-)' : (typeClass === 'allies' ? 'Target: Allies (+)' : 'Target: Self (+)');

        const badgesHtml = statList.map(stat => {
            const cleanVal = stat.value ? String(stat.value).replace(/%/g, '').trim() : '';
            const turns = stat.turns || '1 turn';
            const statIconSrc = getAbsStatIconPath(stat.icon);
            if (isAbsCleanTheme) {
                return `
                    <div class="abs-effect-badge">
                        <img src="${statIconSrc}" alt="stat">
                        ${cleanVal ? `<span class="abs-badge-val">${cleanVal}%</span>` : ''}
                        ${cleanVal && turns ? `<span class="abs-badge-sep">|</span>` : ''}
                        <span class="abs-badge-turns">${turns}</span>
                    </div>
                `;
            }
            return `
                <div class="abs-effect-badge">
                    <div class="abs-badge-top">
                        <img src="${statIconSrc}" alt="stat">
                        ${cleanVal ? `<span>${cleanVal}%</span>` : ''}
                    </div>
                    <div class="abs-badge-fading-divider"></div>
                    <div class="abs-badge-bottom">${turns}</div>
                </div>
            `;
        }).join('');

        if (isAbsCleanTheme) {
            return `
                <div class="abs-effect-group ${typeClass}" data-tooltip="${tooltipTitle}" title="${tooltipTitle}">
                    <div class="abs-group-badges-row">
                        ${badgesHtml}
                    </div>
                </div>
            `;
        }

        return `
            <div class="abs-effect-group ${typeClass}">
                ${getFloatingTagSvg(typeClass)}
                <div class="abs-group-badges-row">
                    ${badgesHtml}
                </div>
            </div>
        `;
    };

    return `
        <div class="abs-special-effects-section">
            <div class="abs-special-effects-title">${isAbsCleanTheme ? 'EFFECTS' : 'SPECIAL EFFECTS'}</div>
            <div class="abs-special-effects-groups">
                ${renderGroup('self', selfStats)}
                ${renderGroup('allies', allyStats)}
                ${renderGroup('enemy', enemyStats)}
            </div>
        </div>
    `;
}

window.renderAbsDamageMultiplier = function(text, typeLabel = '', isActive = false, kiText = '') {
    if (!text) return '';
    const low = text.toLowerCase();
    const lowLabel = typeLabel.toLowerCase().trim();

    if (/ex\b|ex\s/i.test(lowLabel) || lowLabel.startsWith('ex')) return '';

    const baseMultipliers = {
        'mega-colossal': { 10: 440, 15: 490, 20: 570, 25: 620 },
        'colossal':      { 10: 345, 15: 370, 20: 425, 25: 450 },
        'ultimate':      { 10: 550, 15: 600, 20: 650, 25: 700 },
        'immense':       { 10: 505, 15: 570, 20: 630, 25: 705 },
        'supreme':       { 10: 430, 15: 530, 20: 580, 25: 630 },
        'destructive':   { 10: 290, 15: 360, 20: 390, 25: 420 },
        'extreme':       { 10: 355, 15: 450, 20: 480, 25: 510 },
        'mass':          { 10: 355, 15: 450, 20: 480, 25: 510 },
        'huge':          { 10: 290, 15: 360, 20: 390, 25: 420 },
        'low':           { 10: 220, 15: 290, 20: 320, 25: 350 }
    };

    let matchedTier = null;
    if (low.includes('mega-colossal')) matchedTier = 'mega-colossal';
    else if (low.includes('colossal')) matchedTier = 'colossal';
    else if (low.includes('ultimate')) matchedTier = 'ultimate';
    else if (low.includes('immense')) matchedTier = 'immense';
    else if (low.includes('supreme')) matchedTier = 'supreme';
    else if (low.includes('destructive')) matchedTier = 'destructive';
    else if (low.includes('extreme')) matchedTier = 'extreme';
    else if (low.includes('mass')) matchedTier = 'mass';
    else if (low.includes('huge')) matchedTier = 'huge';
    else if (low.includes('low')) matchedTier = 'low';

    if (!matchedTier) return '';

    const activeRarity = window.getDisplayedCardRarity?.() || window.currentRarity || currentRarity;
    const activeAwakening = (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode && currentAwakeningMode !== 'none')
        ? currentAwakeningMode
        : ((window.currentAwakeningMode && window.currentAwakeningMode !== 'none') ? window.currentAwakeningMode : 'none');
    let maxLv = 10;
    const isLR = activeRarity === 'LR';
    const isEZA = activeAwakening === 'eza' || activeAwakening === 'seza';

    if (isLR) maxLv = isEZA ? 25 : 20;
    else maxLv = isEZA ? 15 : 10;

    const maxVal = (baseMultipliers[matchedTier][maxLv] || baseMultipliers[matchedTier][10] || 430) + '%';
    const cleanKi = kiText ? kiText.replace(/[\(\)]/g, '').trim() : '';

    return `
        <div class="abs-damage-multiplier-box">
            <div class="abs-multiplier-left">
                <span class="abs-multiplier-title">DAMAGE MULTIPLIER</span>
                ${cleanKi ? `<span class="abs-multiplier-ki-tag">${cleanKi}</span>` : ''}
            </div>
            <div class="abs-multiplier-pills">
                <div class="abs-multiplier-pill">
                    <span class="pill-val">${maxVal}</span>
                    <span class="pill-at">at</span>
                    <span class="pill-lv">Lv. ${maxLv}</span>
                </div>
            </div>
        </div>
    `;
};

window.updateAbsStyleSuperAttacks = function() {
    const container = document.getElementById('abs-sa-container');
    if (!container) return;

    const blocks = document.querySelectorAll('.sa-block');
    if (blocks.length === 0) {
        container.innerHTML = '';
        window.updateAbsStyleActiveSkills();
        return;
    }

    let htmlBuffer = '';
    const checkIsExSuperBlock = (block) => {
        const label = block.querySelector('.sa-type-label')?.textContent || '';
        const name = block.querySelector('.sa-display-name')?.textContent || '';
        return /^ex\b/i.test(label.trim()) || /\bex\s*super\b/i.test(name);
    };

    const checkIsUnitSuperBlock = (block) => {
        if (!block) return false;
        if (checkIsExSuperBlock(block)) return false;
        if (block.classList.contains('unit-super-block') || block.hasAttribute('data-unit-super')) return true;
        const label = block.querySelector('.sa-type-label')?.textContent || '';
        const name = block.querySelector('.sa-display-name')?.textContent || '';
        const cond = block.querySelector('.activation-text')?.textContent || '';
        return /\bunit\b/i.test(label) || /\bunit\s*super\b/i.test(name) || /whose\s+name\s+includes|when\s+an?\s+ally/i.test(cond);
    };

    const getBlockKi = (block) => {
        const kiAttr = block.getAttribute('data-ki');
        if (kiAttr) {
            const m = kiAttr.match(/\d+/);
            if (m) return parseInt(m[0], 10);
        }
        const lbl = (block.querySelector('.sa-type-label')?.textContent || '').toLowerCase();
        if (lbl.includes('ultra')) return 18;
        return 12;
    };

    const sortedBlocks = Array.from(blocks).sort((a, b) => {
        const aEx = checkIsExSuperBlock(a);
        const bEx = checkIsExSuperBlock(b);
        if (aEx !== bEx) return aEx ? 1 : -1;
        return getBlockKi(a) - getBlockKi(b);
    });

    const standardAttackCount = sortedBlocks.filter(block => !checkIsExSuperBlock(block)).length;

    sortedBlocks.forEach((block) => {
        let typeLabel = block.querySelector('.sa-type-label')?.textContent || 'Super Attack';
        const saName = block.querySelector('.sa-display-name')?.textContent || 'Super Attack';
        const saIcon = block.querySelector('.sa-display-icon')?.getAttribute('src') || 'https://abscustom.github.io/assets/images/sp_skill_icon_01.png';

        const effectCols = block.querySelectorAll('.sa-display-effects-list .col');
        let lines = [];
        effectCols.forEach(c => {
            const txt = c.innerText.trim();
            if (txt && !lines.includes(txt)) lines.push(txt);
        });
        if (lines.length === 0) {
            const raw = block.querySelector('.sa-display-effects-list')?.innerText || '';
            lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        }
        let effectsFormatted = lines.join('<br>');

        let kiText = block.getAttribute('data-ki') || '';
        if (!kiText) {
            const lowLabel = typeLabel.toLowerCase().trim();
            if (lowLabel.includes('ultra')) kiText = '18 Ki';
            else if (lowLabel.includes('super attack')) kiText = '12 Ki';
        }

        let formattedTypeLabel = typeLabel;
        const isExSuperAttack = checkIsExSuperBlock(block);
        const isUnitSuperAttack = !isExSuperAttack && checkIsUnitSuperBlock(block);

        if (isExSuperAttack) {
            formattedTypeLabel = typeLabel.replace(/^ex\b/i, '<span class="abs-ex-prefix">EX</span>');
        } else if (isUnitSuperAttack) {
            formattedTypeLabel = typeLabel.replace(/^unit\b/i, '<span class="abs-unit-prefix">UNIT</span>');
        }

        const stats = getStatsFromBlock(block);
        const specialEffectsHtml = renderAbsSpecialEffects(stats);
        const damageMultiplierHtml = window.renderAbsDamageMultiplier(effectsFormatted, typeLabel, false, kiText);
        const headerDamageMultiplier = damageMultiplierHtml.match(/class="pill-val">([^<]+)</)?.[1] || '';
        const actRow = block.querySelector('.activation-row');
        const actTextEl = block.querySelector('.activation-text');
        let cleanCond = '';
        if (actRow && !actRow.classList.contains('d-none') && actTextEl) {
            cleanCond = (typeof window.extractCleanConditionText === 'function')
                ? window.extractCleanConditionText(actTextEl)
                : actTextEl.innerText || '';
        }
        const formattedCond = cleanCond
            ? (typeof window.formatPassiveText === 'function' ? window.formatPassiveText(cleanCond) : cleanCond)
            : '';
        const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
        let cleanTypePills;
        if (isAbsCleanTheme && isExSuperAttack) {
            cleanTypePills = `<span class="abs-sa-ex-pill">EX</span><span class="abs-sa-type-pill">${typeLabel.replace(/^ex\s*/i, '') || 'Super Attack'}</span>`;
        } else if (isAbsCleanTheme && isUnitSuperAttack) {
            const unitSubLabel = typeLabel.replace(/^unit\s*/i, '').trim() || (typeLabel.toLowerCase().includes('ultra') ? 'Ultra Super Attack' : 'Super Attack');
            cleanTypePills = `<span class="abs-sa-unit-pill">UNIT</span><span class="abs-sa-type-pill">${unitSubLabel}</span>`;
        } else {
            cleanTypePills = `<span class="abs-sa-type-pill">${formattedTypeLabel}</span>`;
        }
        const cleanSaTopStats = document.body.classList.contains('theme-abs-clean') && specialEffectsHtml
            ? `<div class="abs-sa-top-stats">${specialEffectsHtml}</div>`
            : '';
        const cleanSaHeader = document.body.classList.contains('theme-abs-clean')
            ? `<div class="abs-sa-header-title"><span class="abs-sa-pill-actions">${cleanTypePills}</span><span class="abs-sa-title-center"><span class="abs-sa-name-group"><img src="${saIcon}" class="abs-sa-icon-name" alt="SA Category"><em class="abs-sa-name-glow">${saName}</em></span></span><span class="abs-sa-effect-inline"><i>◆</i>${effectsFormatted}</span></div><div class="abs-sa-header-meta"><span class="abs-sa-ki-pill">${kiText}</span>${headerDamageMultiplier ? `<span class="abs-sa-damage-pill">${headerDamageMultiplier}</span>` : ''}</div>`
            : `<div class="abs-sa-header-title"><img src="${saIcon}" class="abs-sa-icon-left" alt="SA Icon"><span class="abs-sa-title-text">${formattedTypeLabel} | <em class="abs-sa-name-glow">${saName}</em></span></div>`;
        const cleanSaContent = isAbsCleanTheme
            ? `<div class="abs-sa-clean-layout"><div class="abs-sa-clean-copy">${formattedCond ? `<div class="abs-skill-label text-warning mb-1">Condition:</div><div class="mb-3">${formattedCond}</div>` : ''}</div></div>`
            : `${formattedCond ? `<div class="abs-skill-label text-warning mb-1">Condition:</div><div class="mb-3">${formattedCond}</div>` : ''}<div class="abs-skill-label text-warning mb-1">Effect:</div><div>${effectsFormatted}</div>${specialEffectsHtml}${damageMultiplierHtml}`;

        htmlBuffer += `
            <div class="abs-box mb-3${isAbsCleanTheme ? ' abs-clean-header-effects' : ''}${isAbsCleanTheme && isExSuperAttack ? ' abs-clean-ex-super-attack' : ''}${isAbsCleanTheme && isUnitSuperAttack ? ' abs-clean-unit-super-attack' : ''}${isAbsCleanTheme && !isExSuperAttack && !isUnitSuperAttack && standardAttackCount === 1 ? ' abs-clean-single-standard-super-attack' : ''}" data-edit="sa">
                <div class="abs-header">
                    ${cleanSaHeader}
                </div>
                <div class="abs-content text-start">
                    ${cleanSaContent}
                </div>
                ${cleanSaTopStats}
            </div>
        `;
    });

    container.innerHTML = htmlBuffer;
    window.updateAbsStyleActiveSkills();
};

window.updateAbsStyleActiveSkills = function() {
    const container = document.getElementById('abs-active-container') || document.getElementById('abs-sa-container');
    const fieldContainer = document.getElementById('abs-field-container');
    if (!container) return;

    const activeBlocks = Array.from(document.querySelectorAll('.active-block'));
    window.normalizeActiveSkillBlocks?.(activeBlocks);
    if (activeBlocks.length === 0) {
        const activeBox = document.getElementById('abs-active-container');
        if (activeBox) activeBox.innerHTML = '';
        if (fieldContainer) fieldContainer.innerHTML = '';
        const standbyBox = document.getElementById('abs-standby-container');
        if (standbyBox) standbyBox.innerHTML = '';
        window.syncAbsCleanRightRail?.();
        return;
    }

    let activeHtml = '';
    let domainHtml = '';
    let standbyHtml = '';

    activeBlocks.forEach((block, sourceIndex) => {
        const activeKind = window.getActiveSkillKind?.(block) || 'active';
        const isDomain = activeKind === 'domain';
        const isStandby = activeKind === 'standby';
        const isActiveSkill = !isDomain && !isStandby;
        const typeLabel = block.querySelector('.active-type-label')?.textContent ||
            (isDomain ? 'Dokkan Field' : (isStandby ? 'Standby' : 'Active Skill'));
        const cleanTypeLabel = isDomain ? 'Dokkan Field' : (isStandby ? 'Standby' : typeLabel);
        const name = block.querySelector('.active-display-name')?.textContent || 'Active Skill';
        let effect = block.querySelector('.active-display-effect')?.innerText || '';
        const conditionRow = block.querySelector('.active-condition-row');
        const conditionTitle = block.querySelector('.active-display-condition-title')?.textContent || 'Activation Condition(s)';
        let condition = block.querySelector('.active-display-condition')?.innerText || '';
        const showCondition = Boolean(condition.trim()) && !conditionRow?.classList.contains('d-none');
        if (window.formatCategoryQuotes) {
            effect = window.formatCategoryQuotes(effect);
            condition = window.formatCategoryQuotes(condition);
        }

        const activeIconAttr = isStandby
            ? ''
            : (block.querySelector('.active-display-icon')?.getAttribute('src') ||
                (isDomain ? 'https://abscustom.github.io/assets/images/ing_label_field.png' : ''));
        const hasNoIcon = !activeIconAttr || activeIconAttr === 'none' || activeIconAttr.includes('none');
        const activeIconHtml = hasNoIcon ? '' : `<img src="${activeIconAttr}" class="abs-sa-icon-left" alt="Active Icon">`;

        const damageMultiplierHtml = window.renderAbsDamageMultiplier(effect, typeLabel, true, '');
        const headerDamageMultiplier = damageMultiplierHtml.match(/class="pill-val">([^<]+)</)?.[1] || '';
        const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
        const showCleanDivider = isAbsCleanTheme;
        const cleanDividerClass = isDomain
            ? 'abs-clean-active-divider abs-clean-field-divider'
            : 'abs-clean-active-divider';
        const cleanActiveHeader = isAbsCleanTheme
            ? `<div class="abs-sa-header-title"><span class="abs-sa-pill-actions"><span class="abs-sa-type-pill">${cleanTypeLabel}</span></span><span class="abs-sa-title-center"><span class="abs-sa-name-group">${activeIconHtml.replace('abs-sa-icon-left', 'abs-sa-icon-name')}<em class="abs-sa-name-glow">${name}</em></span></span></div><div class="abs-sa-header-meta">${headerDamageMultiplier ? `<span class="abs-sa-damage-pill">${headerDamageMultiplier}</span>` : ''}</div>`
            : `<div class="abs-sa-header-title">${activeIconHtml}<span class="abs-sa-title-text">${typeLabel} | <em class="abs-sa-name-glow">${name}</em></span></div>`;
        const cleanFieldStatBadges = isAbsCleanTheme && isDomain && typeof window.renderAbsCleanFieldStatBadges === 'function'
            ? window.renderAbsCleanFieldStatBadges(effect, block)
            : '';
        const cleanActiveClass = isAbsCleanTheme
            ? ` abs-clean-active-rendered${isDomain ? ' abs-clean-domain-rendered' : ''}${isStandby ? ' abs-clean-standby-rendered' : ''}`
            : '';
        const cleanActiveEditAttr = isAbsCleanTheme
            ? ' data-edit="active"'
            : '';
        const cleanActiveSourceAttr = isAbsCleanTheme
            ? ` data-abs-clean-source-index="${sourceIndex}"`
            : '';

        const skillHtml = `
            <div class="abs-box mb-3${cleanActiveClass}" data-active-kind="${activeKind}"${cleanActiveEditAttr}${cleanActiveSourceAttr}>
                <div class="abs-header">
                    ${cleanActiveHeader}
                </div>
                <div class="abs-content text-start">
                    ${showCondition ? `
                        <div class="abs-skill-label text-warning mb-1">${conditionTitle}:</div>
                        <div class="mb-3">${condition.replace(/\n/g, '<br>')}</div>
                    ` : ''}
                    ${(isActiveSkill || isStandby) && showCondition && showCleanDivider ? `<div class="${cleanDividerClass} abs-clean-standby-divider" aria-hidden="true"><hr class="divider py bg-secondary"></div>` : ''}
                    <div class="abs-skill-label text-warning mb-1">${isDomain ? 'Dokkan Field Effect:' : (isStandby ? 'Standby Skill Effect:' : 'Effect:')}</div>
                    <div class="${isDomain && isAbsCleanTheme ? 'abs-clean-field-effect-copy' : (isStandby && isAbsCleanTheme ? 'abs-clean-standby-effect-copy' : '')}">${effect}</div>
                    ${isDomain && showCleanDivider ? `<div class="${cleanDividerClass}" aria-hidden="true"><hr class="divider py bg-secondary"></div>` : ''}
                    ${cleanFieldStatBadges}
                    ${isAbsCleanTheme ? '' : damageMultiplierHtml}
                </div>
            </div>
        `;
        if (isDomain) domainHtml += skillHtml;
        else if (isStandby) standbyHtml += skillHtml;
        else activeHtml += skillHtml;
    });

    const activeContainer = document.getElementById('abs-active-container');
    const standbyContainer = document.getElementById('abs-standby-container');
    if (activeContainer) activeContainer.innerHTML = activeHtml;
    if (fieldContainer) fieldContainer.innerHTML = domainHtml;
    if (standbyContainer) standbyContainer.innerHTML = standbyHtml;
    window.syncAbsCleanRightRail?.();
};

// Global Floating Tooltip Controller for Passive Ability Badges
(function setupGlobalFloatingTooltip() {
    let tooltipEl = null;

    function getOrCreateTooltip() {
        if (!tooltipEl) {
            tooltipEl = document.getElementById('abs-global-floating-tooltip');
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.id = 'abs-global-floating-tooltip';
                document.body.appendChild(tooltipEl);
            }
        }
        return tooltipEl;
    }

    document.addEventListener('mouseover', function(e) {
        const badge = e.target.closest('[data-tooltip]');
        if (!badge) return;

        const text = badge.getAttribute('data-tooltip');
        if (!text) return;

        const tip = getOrCreateTooltip();
        tip.classList.toggle('info-link-tooltip', Boolean(badge.closest('#card-link-container a')));
        tip.textContent = text;
        tip.style.display = 'block';

        const rect = badge.getBoundingClientRect();
        const tipWidth = tip.offsetWidth;
        const tipHeight = tip.offsetHeight;

        let top = rect.top - tipHeight - 8;
        let left = rect.left + (rect.width / 2) - (tipWidth / 2);

        if (top < 10) top = rect.bottom + 8;
        if (left < 10) left = 10;
        if (left + tipWidth > window.innerWidth - 10) {
            left = window.innerWidth - tipWidth - 10;
        }

        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.style.opacity = '1';
    });

    document.addEventListener('mouseout', function(e) {
        const badge = e.target.closest('[data-tooltip]');
        if (!badge) return;
        if (e.relatedTarget && badge.contains(e.relatedTarget)) return;
        if (tooltipEl) {
            tooltipEl.style.opacity = '0';
            tooltipEl.style.display = 'none';
        }
    });
})();

window.currentEditorArtMode = 'animated';

window.switchEditorArtMode = function(mode) {
    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
    window.currentEditorArtMode = mode;
    const isAnim = (mode === 'animated');
    window.syncAbsCleanCategoryArtModeButtons?.(mode);
    if (isAbsCleanTheme) window.syncAbsCleanArtMediaMode?.(mode);

    const artBox = document.getElementById('abs-art-layers-container');
    const staticBtn = document.getElementById('art-toggle-static');
    const animatedBtn = document.getElementById('art-toggle-animated');
    const lwfCanvas = document.getElementById('abs-card-bg-lwf-canvas');
    const stickerCanvas = document.getElementById('abs-tur-sticker-canvas');
    const bgImgEl = document.getElementById('abs-art-bg');
    const charImgEl = document.getElementById('abs-art-char');
    const effectImgEl = document.getElementById('abs-art-effect');
    const singleArtImg = document.getElementById('abs-art-img');
    const singleVidEl = document.getElementById('abs-art-video');
    const mainVid = document.getElementById('myOverlayVideo');

    if (staticBtn) staticBtn.classList.toggle('active', !isAnim);
    if (animatedBtn) animatedBtn.classList.toggle('active', isAnim);

    if (artBox) {
        artBox.classList.toggle('static-mode', !isAnim);
        artBox.classList.toggle('animated-mode', isAnim);
    }

    const hasMultiLayer = (bgImgEl && bgImgEl.src && !bgImgEl.src.endsWith('none') && !bgImgEl.src.endsWith('/') && !bgImgEl.src.endsWith('editor.html') && !bgImgEl.dataset.failed) ||
                          (charImgEl && charImgEl.src && !charImgEl.src.endsWith('none') && !charImgEl.src.endsWith('/') && !charImgEl.src.endsWith('editor.html') && !charImgEl.dataset.failed);

    const hasVideo = singleVidEl && singleVidEl.src && !singleVidEl.src.endsWith('/') && !singleVidEl.src.endsWith('editor.html') && singleVidEl.src !== window.location.href;

    if (isAnim) {
        const hasLwfActive = lwfCanvas && lwfCanvas.classList.contains('lwf-active');
        if (hasLwfActive) {
            if (lwfCanvas) {
                lwfCanvas.style.display = 'block';
                if (window.DokkanLWF && window.DokkanLWF.play) window.DokkanLWF.play(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
            }
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
        } else if (hasMultiLayer) {
            if (bgImgEl && !bgImgEl.dataset.failed) bgImgEl.style.display = 'block';
            if (charImgEl) charImgEl.style.display = 'block';
            if (effectImgEl && effectImgEl.src && !effectImgEl.dataset.failed) effectImgEl.style.display = 'block';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
        } else if (hasVideo) {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) {
                singleVidEl.style.display = 'block';
                singleVidEl.play().catch(()=>{});
            }
            if (mainVid && mainVid.querySelector('source')?.src) {
                mainVid.play().catch(()=>{});
            }
            if (lwfCanvas) lwfCanvas.style.display = 'none';
        } else {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'block';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
        }
        if (stickerCanvas && stickerCanvas.classList.contains('sticker-active')) stickerCanvas.style.display = 'block';
    } else {
        // STATIC / SIMPLE MODE: show the complete layered card composition.
        if (hasMultiLayer) {
            if (isAbsCleanTheme) {
                artBox?.classList.remove('has-flat-static-art');
                if (bgImgEl && !bgImgEl.dataset.failed) bgImgEl.style.display = 'block';
                if (charImgEl && !charImgEl.dataset.failed) charImgEl.style.display = 'block';
                if (effectImgEl && effectImgEl.src && !effectImgEl.dataset.failed) effectImgEl.style.display = 'block';
            } else {
                if (bgImgEl) bgImgEl.style.display = 'none';
                if (effectImgEl) effectImgEl.style.display = 'none';
            }
            if (lwfCanvas) {
                lwfCanvas.style.display = 'none';
                if (window.DokkanLWF && window.DokkanLWF.pause) window.DokkanLWF.pause(lwfCanvas.id || 'abs-card-bg-lwf-canvas');
            }
            if (stickerCanvas) stickerCanvas.style.display = 'none';
            if (charImgEl && charImgEl.src && !charImgEl.src.endsWith('/') && !charImgEl.dataset.failed) {
                charImgEl.style.display = 'block';
            }
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
        } else if (hasVideo) {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
            if (stickerCanvas) stickerCanvas.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'none';
            if (singleVidEl) {
                singleVidEl.style.display = 'block';
                singleVidEl.currentTime = 0;
                singleVidEl.pause();
            }
            if (mainVid && mainVid.querySelector('source')?.src) {
                mainVid.currentTime = 0;
                mainVid.pause();
            }
        } else {
            if (bgImgEl) bgImgEl.style.display = 'none';
            if (charImgEl) charImgEl.style.display = 'none';
            if (effectImgEl) effectImgEl.style.display = 'none';
            if (lwfCanvas) lwfCanvas.style.display = 'none';
            if (stickerCanvas) stickerCanvas.style.display = 'none';
            if (singleVidEl) singleVidEl.style.display = 'none';
            if (singleArtImg) singleArtImg.style.display = 'block';
        }
}
};

window.syncAbsCleanIdentityIcons = function() {
    const dock = document.getElementById('abs-clean-identity-icons');
    if (!dock) return;
    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
    if (!isAbsCleanTheme) {
        dock.hidden = true;
        return;
    }

    const activeRarity = (typeof currentRarity !== 'undefined' && currentRarity && currentRarity !== 'none')
        ? currentRarity
        : ((window.currentRarity && window.currentRarity !== 'none') ? window.currentRarity : 'LR');

    const activeAwakening = (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode && currentAwakeningMode !== 'none')
        ? currentAwakeningMode
        : ((window.currentAwakeningMode && window.currentAwakeningMode !== 'none') ? window.currentAwakeningMode : 'none');

    const curType = String(window.currentType || (typeof currentType !== 'undefined' ? currentType : 'agl')).toUpperCase();
    const fullTypeStr = curType;

    // 1. Rarity (label + value wired explicitly)
    const badgeRarity = document.getElementById('abs-clean-badge-rarity');
    const valRarity = document.getElementById('abs-clean-val-rarity');
    if (valRarity) valRarity.textContent = activeRarity;
    badgeRarity?.querySelector('.abs-clean-badge-label') && (badgeRarity.querySelector('.abs-clean-badge-label').textContent = 'RARITY');
    if (badgeRarity) {
        badgeRarity.hidden = false;
    }

    // 2. Class (Super / Extreme) sits between rarity and type.
    const badgeClass = document.getElementById('abs-clean-badge-class');
    const valClass = document.getElementById('abs-clean-val-class');
    const activeClass = String(window.currentClass || (typeof currentClass !== 'undefined' ? currentClass : 'super')).toLowerCase();
    if (valClass) valClass.textContent = activeClass.toUpperCase();
    badgeClass?.querySelector('.abs-clean-badge-label') && (badgeClass.querySelector('.abs-clean-badge-label').textContent = 'CLASS');
    if (badgeClass) {
        badgeClass.hidden = activeClass === 'none';
    }

    // 3. Type (label + value wired explicitly)
    const badgeType = document.getElementById('abs-clean-badge-type');
    const valType = document.getElementById('abs-clean-val-type');
    if (valType) valType.textContent = fullTypeStr;
    badgeType?.querySelector('.abs-clean-badge-label') && (badgeType.querySelector('.abs-clean-badge-label').textContent = 'TYPE');
    if (badgeType) {
        badgeType.hidden = false;
    }

    // 4. Unit tag — hidden entirely when the source has no tag.
    const badgeTag = document.getElementById('abs-clean-badge-tag');
    const valTag = document.getElementById('abs-clean-val-tag');
    const unitTag = window.normalizeAbsCleanUnitTag?.(window.absUnitTag) || '';
    if (valTag) valTag.textContent = unitTag;
    if (badgeTag) {
        if (unitTag) {
            badgeTag.hidden = false;
            badgeTag.style.display = '';
        } else {
            badgeTag.hidden = true;
            badgeTag.style.display = 'none';
            badgeTag.remove();
        }
    }

    // 5. Awakening — hidden entirely on BASE; visible order is rarity, class,
    // type, tag, then awakening.
    const badgeAwakening = document.getElementById('abs-clean-badge-awakening');
    const valAwakening = document.getElementById('abs-clean-val-awakening');
    if (badgeAwakening && valAwakening) {
        const labelEl = badgeAwakening.querySelector('.abs-clean-badge-label');
        if (activeAwakening === 'eza') {
            if (labelEl) labelEl.textContent = 'AWAKENING';
            valAwakening.textContent = 'EZA';
            badgeAwakening.hidden = false;
            badgeAwakening.style.display = '';
        } else if (activeAwakening === 'seza') {
            if (labelEl) labelEl.textContent = 'AWAKENING';
            valAwakening.textContent = 'SEZA';
            badgeAwakening.hidden = false;
            badgeAwakening.style.display = '';
        } else {
            valAwakening.textContent = '';
            badgeAwakening.hidden = true;
            badgeAwakening.style.display = 'none';
            badgeAwakening.remove();
        }
    }

    // Fixed visual order: rarity, class, type, tag, then awakening.
    if (badgeRarity && badgeType) {
        dock.append(badgeRarity);
        if (badgeClass) dock.appendChild(badgeClass);
        dock.appendChild(badgeType);
        if (badgeTag && unitTag) dock.appendChild(badgeTag);
        else if (badgeTag) {
            badgeTag.hidden = true;
            badgeTag.style.display = 'none';
            badgeTag.remove();
        }
        if (badgeAwakening && activeAwakening !== 'base' && (activeAwakening === 'eza' || activeAwakening === 'seza')) dock.appendChild(badgeAwakening);
        else if (badgeAwakening) {
            badgeAwakening.hidden = true;
            badgeAwakening.style.display = 'none';
            badgeAwakening.remove();
        }
    }

    // 4. Release Date
    const valRelease = document.getElementById('abs-clean-val-release');
    if (valRelease) {
        const rawDate = document.getElementById('dateInput')?.value?.trim() || 'TBD';
        valRelease.textContent = rawDate;
    }

    // 5. Timeline Rarity
    const timelineRarity = document.getElementById('abs-clean-timeline-rarity');
    if (timelineRarity) timelineRarity.textContent = activeRarity;

    dock.hidden = false;
};

window.syncAbsCleanInfoBar = function() {
    const infoBar = document.getElementById('abs-clean-info-bar');
    if (!infoBar) return;
    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
    if (!isAbsCleanTheme) {
        infoBar.innerHTML = '';
        infoBar.hidden = true;
        return;
    }

    const sbaColors = { agl: '#00a2ff', teq: '#22c55e', int: '#a855f7', str: '#ef4444', phy: '#eab308' };
    const cardType = String(window.currentType || (typeof currentType !== 'undefined' ? currentType : 'agl')).toLowerCase();
    infoBar.style.setProperty('--abs-clean-ring-color', sbaColors[cardType] || '#38bdf8');

    const activeRarity = window.getDisplayedCardRarity?.() || window.currentRarity || (typeof currentRarity !== 'undefined' ? currentRarity : 'TUR');
    const activeAwakening = (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode && currentAwakeningMode !== 'none')
        ? currentAwakeningMode
        : ((window.currentAwakeningMode && window.currentAwakeningMode !== 'none') ? window.currentAwakeningMode : 'none');
    const rawType = String(window.currentType || (typeof currentType !== 'undefined' ? currentType : 'agl')).toUpperCase();

    // abs.clean uses the compact type code only (TEQ, STR, etc.).
    const typeText = rawType;

    const items = [];
    if (activeRarity && activeRarity !== 'none') {
        items.push({ id: 'rarity', label: 'RARITY', value: activeRarity, rarity: activeRarity.toLowerCase() });
    }
    if (rawType && rawType !== 'NONE') {
        items.push({ id: 'type', label: 'TYPE', value: typeText });
    }
    if (activeAwakening === 'eza') {
        items.push({ id: 'awakening', label: 'AWAKENING', value: 'EZA', awakening: 'eza' });
    } else if (activeAwakening === 'seza') {
        items.push({ id: 'awakening', label: 'AWAKENING', value: 'SEZA', awakening: 'seza' });
    }

    if (items.length === 0) {
        infoBar.innerHTML = '';
        infoBar.hidden = true;
        return;
    }
    infoBar.hidden = false;

    // In-place reconciliation so CSS gradient animations never reset when typing
    const existingBoxes = Array.from(infoBar.querySelectorAll('.abs-clean-info-box'));
    const sameItems = existingBoxes.length === items.length && items.every((item, idx) => {
        return existingBoxes[idx].dataset.item === item.id && !!existingBoxes[idx].querySelector('.abs-clean-info-content');
    });

    if (sameItems) {
        items.forEach((item, idx) => {
            const box = existingBoxes[idx];
            if (item.rarity && box.dataset.rarity !== item.rarity) box.dataset.rarity = item.rarity;
            if (item.awakening && box.dataset.awakening !== item.awakening) box.dataset.awakening = item.awakening;
            const labelEl = box.querySelector('.abs-clean-info-label');
            if (labelEl && labelEl.textContent !== item.label) labelEl.textContent = item.label;
            const valEl = box.querySelector('.abs-clean-info-value');
            if (valEl && valEl.textContent !== item.value) valEl.textContent = item.value;
        });
    } else {
        infoBar.innerHTML = items.map(item => `
            <div class="abs-clean-info-box" data-item="${item.id}" ${item.rarity ? `data-rarity="${item.rarity}"` : ''} ${item.awakening ? `data-awakening="${item.awakening}"` : ''}>
                <div class="abs-clean-info-content">
                    <span class="abs-clean-info-label">${item.label}</span>
                    <span class="abs-clean-info-value">${item.value}</span>
                </div>
            </div>
        `).join('');
    }
};

window.syncAbsCleanReleaseDate = function() {
    const el = document.getElementById('abs-clean-release-date');
    if (!el) return;

    const dateEl = document.getElementById('dateInput');
    const ezaDateEl = document.getElementById('ezaDateInput');
    const sezaDateEl = document.getElementById('sezaDateInput');

    const baseDate = (dateEl ? dateEl.value.trim() : "") || (el.dataset.baseDate || "") || "";
    const ezaDate = (ezaDateEl ? ezaDateEl.value.trim() : "") || "";
    const sezaDate = (sezaDateEl ? sezaDateEl.value.trim() : "") || "";

    const activeAwakening = (typeof currentAwakeningMode !== 'undefined' && currentAwakeningMode && currentAwakeningMode !== 'none')
        ? currentAwakeningMode
        : ((window.currentAwakeningMode && window.currentAwakeningMode !== 'none') ? window.currentAwakeningMode : 'none');

    const isSeza = activeAwakening === 'seza' || (activeAwakening !== 'none' && activeAwakening !== 'eza' && !!sezaDate && sezaDate !== 'TBD');
    const isEza = !isSeza && (activeAwakening === 'eza' || (activeAwakening !== 'none' && !!ezaDate && ezaDate !== 'TBD'));

    const items = [];
    if (isSeza) {
        items.push({ label: 'Release:', value: baseDate || 'TBD' });
        items.push({ label: 'EZA:', value: ezaDate || 'TBD' });
        items.push({ label: 'Super EZA:', value: sezaDate || 'TBD' });
    } else if (isEza) {
        items.push({ label: 'Release:', value: baseDate || 'TBD' });
        items.push({ label: 'EZA:', value: ezaDate || 'TBD' });
    } else {
        items.push({ label: 'Release Date:', value: baseDate || 'TBD' });
    }

    el.innerHTML = items.map(item => `
        <span class="abs-clean-date-item"><span class="abs-clean-date-label">${item.label}</span> <span class="abs-clean-date-val">${item.value}</span></span>
    `.trim()).join('<span class="abs-clean-date-sep">•</span>');
};

window.syncAbsCleanLeaderBar = function() {
    const leaderBar = document.getElementById('abs-clean-leader-bar');
    if (!leaderBar) return;
    const isAbsCleanTheme = document.body.classList.contains('theme-abs-clean');
    if (!isAbsCleanTheme) {
        leaderBar.hidden = true;
        return;
    }

    const leaderText = document.getElementById('leaderInput')?.value ||
                       document.getElementById('leader-skill')?.innerText ||
                       document.getElementById('abs-leader-skill')?.innerText || "";
    const cleanLeader = leaderText.replace(/[\r\n]+/g, ' ').trim();
    const leaderTextEl = document.getElementById('abs-clean-leader-text');
    if (leaderTextEl) {
        const formatted = cleanLeader
            ? (window.formatOfficialText ? window.formatOfficialText(cleanLeader, true) : (window.formatCategoryQuotes ? window.formatCategoryQuotes(cleanLeader) : cleanLeader))
            : "Leader Skill details...";
        leaderTextEl.innerHTML = formatted;
    }
    leaderBar.hidden = false;
};

/* ==========================================================================
   ABS CLEAN DOKKAN SPACE GRID & COSMIC PULSES
   Authentic Dokkan Battle curved space grid with cosmic starfield and
   slow, glowing transparent energy nodes traveling along the curved lines.
   ========================================================================== */
(() => {
    let animId = null;
    let canvas = null;
    let ctx = null;
    let baseCanvas = null;
    let baseCtx = null;
    let baseWidth = 0;
    let baseHeight = 0;
    let basePaletteKey = '';
    let lastFrameTime = 0;
    const TARGET_FRAME_MS = 1000 / 30;
    const BACKGROUND_MAX_DPR = 1.25;
    const GRID = 36;
    const pulses = [];
    const MAX_PULSES = 2; // Keep the moving accents atmospheric and inexpensive.
    let stars = [];
    let nebulae = [];

    const cosmicPalettes = {
        agl: { light: { nebula: 'rgba(37, 99, 235, 0.16)', line: 'rgba(37, 99, 235, 0.24)', pulse: 'rgba(37, 99, 235, 0.86)', halo: 'rgba(59, 130, 246, 0.72)', core: '#2563eb' }, dark: { nebula: 'rgba(37, 99, 235, 0.20)', line: 'rgba(96, 165, 250, 0.18)', pulse: 'rgba(96, 165, 250, 0.82)', halo: 'rgba(59, 130, 246, 0.62)', core: '#60a5fa' } },
        teq: { light: { nebula: 'rgba(34, 197, 94, 0.16)', line: 'rgba(22, 163, 74, 0.24)', pulse: 'rgba(22, 163, 74, 0.86)', halo: 'rgba(34, 197, 94, 0.72)', core: '#16a34a' }, dark: { nebula: 'rgba(34, 197, 94, 0.20)', line: 'rgba(74, 222, 128, 0.18)', pulse: 'rgba(74, 222, 128, 0.82)', halo: 'rgba(34, 197, 94, 0.62)', core: '#4ade80' } },
        int: { light: { nebula: 'rgba(168, 85, 247, 0.16)', line: 'rgba(126, 34, 206, 0.24)', pulse: 'rgba(126, 34, 206, 0.86)', halo: 'rgba(168, 85, 247, 0.72)', core: '#7e22ce' }, dark: { nebula: 'rgba(168, 85, 247, 0.20)', line: 'rgba(192, 132, 252, 0.18)', pulse: 'rgba(192, 132, 252, 0.82)', halo: 'rgba(168, 85, 247, 0.62)', core: '#c084fc' } },
        str: { light: { nebula: 'rgba(239, 68, 68, 0.16)', line: 'rgba(185, 28, 28, 0.24)', pulse: 'rgba(185, 28, 28, 0.86)', halo: 'rgba(239, 68, 68, 0.72)', core: '#b91c1c' }, dark: { nebula: 'rgba(239, 68, 68, 0.20)', line: 'rgba(248, 113, 113, 0.18)', pulse: 'rgba(248, 113, 113, 0.82)', halo: 'rgba(239, 68, 68, 0.62)', core: '#f87171' } },
        phy: { light: { nebula: 'rgba(234, 179, 8, 0.16)', line: 'rgba(202, 138, 4, 0.24)', pulse: 'rgba(202, 138, 4, 0.86)', halo: 'rgba(234, 179, 8, 0.72)', core: '#ca8a04' }, dark: { nebula: 'rgba(234, 179, 8, 0.20)', line: 'rgba(253, 224, 71, 0.18)', pulse: 'rgba(253, 224, 71, 0.82)', halo: 'rgba(234, 179, 8, 0.62)', core: '#fde047' } },
        none: { light: { nebula: 'rgba(113, 113, 122, 0.14)', line: 'rgba(82, 82, 91, 0.20)', pulse: 'rgba(82, 82, 91, 0.78)', halo: 'rgba(113, 113, 122, 0.58)', core: '#52525b' }, dark: { nebula: 'rgba(113, 113, 122, 0.16)', line: 'rgba(212, 212, 216, 0.16)', pulse: 'rgba(212, 212, 216, 0.72)', halo: 'rgba(161, 161, 170, 0.52)', core: '#d4d4d8' } }
    };

    function activeCosmicPalette(isLightMode) {
        const type = document.body.dataset.absCleanType || window.currentType || currentType || 'none';
        const palette = cosmicPalettes[type] || cosmicPalettes.none;
        return palette[isLightMode ? 'light' : 'dark'];
    }

    // Deterministic PRNG so starfield is consistent across frames and resizes
    function createRng(seed) {
        let s = seed;
        return () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }

    function withAlpha(rgba, alpha) {
        return rgba.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
    }

    function initCosmos(w, h) {
        const rng = createRng(198906);
        stars = [];
        // A static base layer keeps the same atmosphere without redrawing
        // hundreds of star paths on every animation frame.
        for (let i = 0; i < 90; i++) {
            stars.push({
                x: rng() * w,
                y: rng() * h,
                r: 0.35 + rng() * 0.65,
                alpha: 0.25 + rng() * 0.65,
                isBlue: rng() > 0.85,
                hasCross: false
            });
        }
        // A smaller prominent-star layer preserves the recognizable crosses.
        for (let i = 0; i < 22; i++) {
            stars.push({
                x: rng() * w,
                y: rng() * h,
                r: 0.8 + rng() * 0.9,
                alpha: 0.45 + rng() * 0.5,
                isBlue: rng() > 0.75,
                hasCross: rng() > 0.80
            });
        }

        nebulae = [
            { x: w * 0.25, y: h * 0.28, r: Math.max(w, h) * 0.25, c: 'rgba(12, 28, 48, 0.12)' },
            { x: w * 0.75, y: h * 0.35, r: Math.max(w, h) * 0.28, c: 'rgba(10, 22, 42, 0.14)' },
            { x: w * 0.45, y: h * 0.72, r: Math.max(w, h) * 0.30, c: 'rgba(14, 25, 45, 0.10)' },
            { x: w * 0.18, y: h * 0.82, r: Math.max(w, h) * 0.22, c: 'rgba(12, 30, 55, 0.08)' },
            { x: w * 0.82, y: h * 0.80, r: Math.max(w, h) * 0.24, c: 'rgba(10, 25, 48, 0.10)' }
        ];
    }

    // Dokkan concave 3D perspective projection:
    // Mild outward curve on edges, gentle concave dip in center
    function project(gx, gy, w, h) {
        const nx = (gx - w / 2) / (w / 2); // -1 to 1 horizontally
        const ny = (gy - h / 2) / (h / 2); // -1 to 1 vertically
        const bow = 18 * nx * (1 - ny * ny * 0.45);
        const sag = 20 * (1 - nx * nx) * (0.65 + 0.35 * (gy / Math.max(1, h)));
        return {
            x: gx + bow,
            y: gy + sag
        };
    }

    function paletteKey(isLightMode) {
        const type = document.body.dataset.absCleanType || window.currentType || (typeof currentType !== 'undefined' ? currentType : 'none') || 'none';
        return `${isLightMode ? 'light' : 'dark'}:${type}`;
    }

    function resizeCanvas() {
        if (!canvas) return;
        const dpr = Math.min(window.devicePixelRatio || 1, BACKGROUND_MAX_DPR);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx = canvas.getContext('2d', { alpha: true, desynchronized: true }) || canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!baseCanvas) baseCanvas = document.createElement('canvas');
        baseCanvas.width = Math.floor(w * dpr);
        baseCanvas.height = Math.floor(h * dpr);
        baseCtx = baseCanvas.getContext('2d', { alpha: true, desynchronized: true }) || baseCanvas.getContext('2d');
        baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        baseWidth = w;
        baseHeight = h;
        basePaletteKey = '';
        initCosmos(w, h);
    }

    function renderStaticBase(w, h, isLightMode, cosmic) {
        if (!baseCtx) return;

        baseCtx.clearRect(0, 0, w, h);

        // Nebulae and stars are static artwork. They are rendered once per
        // resize/theme/type change instead of being rebuilt at 60 FPS.
        for (let i = 0; i < nebulae.length; i++) {
            const neb = nebulae[i];
            const rad = baseCtx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
            rad.addColorStop(0, cosmic.nebula);
            rad.addColorStop(1, 'transparent');
            baseCtx.fillStyle = rad;
            baseCtx.beginPath();
            baseCtx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
            baseCtx.fill();
        }

        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const a = s.alpha;
            baseCtx.fillStyle = isLightMode
                ? (s.isBlue ? `rgba(15, 23, 42, ${a})` : `rgba(0, 0, 0, ${a})`)
                : (s.isBlue ? `rgba(224, 242, 254, ${a})` : `rgba(255, 255, 255, ${a})`);
            baseCtx.beginPath();
            baseCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            baseCtx.fill();

            if (s.hasCross && a > 0.65) {
                baseCtx.strokeStyle = isLightMode
                    ? `rgba(15, 23, 42, ${a * 0.65})`
                    : `rgba(224, 242, 254, ${a * 0.65})`;
                baseCtx.lineWidth = 0.6;
                const arm = s.r * 3.2;
                baseCtx.beginPath();
                baseCtx.moveTo(s.x - arm, s.y); baseCtx.lineTo(s.x + arm, s.y);
                baseCtx.moveTo(s.x, s.y - arm); baseCtx.lineTo(s.x, s.y + arm);
                baseCtx.stroke();
            }
        }

        baseCtx.save();
        baseCtx.lineWidth = isLightMode ? 1.15 : 0.95;
        baseCtx.strokeStyle = cosmic.line;

        const numRows = Math.ceil(h / GRID) + 2;
        for (let j = -1; j <= numRows; j++) {
            const gy = j * GRID;
            baseCtx.beginPath();
            for (let gx = -20; gx <= w + 20; gx += 18) {
                const pt = project(gx, gy, w, h);
                if (gx === -20) baseCtx.moveTo(pt.x, pt.y);
                else baseCtx.lineTo(pt.x, pt.y);
            }
            baseCtx.stroke();
        }

        const numCols = Math.ceil(w / GRID) + 2;
        for (let i = -1; i <= numCols; i++) {
            const gx = i * GRID;
            baseCtx.beginPath();
            for (let gy = -20; gy <= h + 20; gy += 18) {
                const pt = project(gx, gy, w, h);
                if (gy === -20) baseCtx.moveTo(pt.x, pt.y);
                else baseCtx.lineTo(pt.x, pt.y);
            }
            baseCtx.stroke();
        }
        baseCtx.restore();
    }

    function createPulse(w, h, isInitial = false) {
        const isHorizontal = Math.random() > 0.4;
        const forward = Math.random() > 0.48;
        // Calm, slow gliding speed: ~0.35 to 0.70 px per frame
        const speed = (0.35 + Math.random() * 0.35) * (forward ? 1 : -1);
        const tailLength = 22 + Math.random() * 16;

        if (isHorizontal) {
            const rowCount = Math.max(1, Math.floor(h / GRID));
            const row = Math.floor(Math.random() * (rowCount + 1));
            const gy = row * GRID;
            const gx = isInitial ? (0.12 + Math.random() * 0.76) * w : (forward ? -tailLength : w + tailLength);
            return {
                isHorizontal: true,
                gx,
                gy,
                v: speed,
                tailLength
            };
        } else {
            const colCount = Math.max(1, Math.floor(w / GRID));
            const col = Math.floor(Math.random() * (colCount + 1));
            const gx = col * GRID;
            const gy = isInitial ? (0.12 + Math.random() * 0.76) * h : (forward ? -tailLength : h + tailLength);
            return {
                isHorizontal: false,
                gx,
                gy,
                v: speed,
                tailLength
            };
        }
    }

    let frameCount = 0;

    function step(timestamp = performance.now()) {
        if (!document.body.classList.contains('theme-abs-clean')) {
            animId = null;
            if (ctx && canvas) {
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.restore();
            }
            lastFrameTime = 0;
            return;
        }

        if (document.hidden) {
            animId = null;
            lastFrameTime = 0;
            return;
        }

        if (!canvas) {
            canvas = document.getElementById('abs-clean-grid-circuit');
            if (!canvas) {
                animId = requestAnimationFrame(step);
                return;
            }
            resizeCanvas();
            window.addEventListener('resize', resizeCanvas, { passive: true });
        }

        const w = window.innerWidth;
        const h = window.innerHeight;
        if (baseWidth !== w || baseHeight !== h) resizeCanvas();

        const isLightMode = !document.body.classList.contains('theme-abs-clean-dark');
        const cosmic = activeCosmicPalette(isLightMode);
        const currentPaletteKey = paletteKey(isLightMode);
        if (!baseCtx || basePaletteKey !== currentPaletteKey) {
            renderStaticBase(w, h, isLightMode, cosmic);
            basePaletteKey = currentPaletteKey;
        }

        if (!lastFrameTime) lastFrameTime = timestamp - TARGET_FRAME_MS;
        const elapsed = timestamp - lastFrameTime;
        if (elapsed < TARGET_FRAME_MS) {
            animId = requestAnimationFrame(step);
            return;
        }
        lastFrameTime = timestamp;
        const movementScale = Math.min(3, Math.max(0.5, elapsed / (1000 / 60)));
        frameCount++;

        // Copy the pre-rendered nebula, stars, and curved grid in one draw.
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(baseCanvas, 0, 0, w, h);

        // Update and render only the small moving accents. These use solid
        // paths/circles instead of per-frame linear/radial gradients or
        // shadowBlur, which were the largest source of background GPU work.
        while (pulses.length < MAX_PULSES) {
            pulses.push(createPulse(w, h, frameCount <= 3));
        }

        for (let i = pulses.length - 1; i >= 0; i--) {
            const p = pulses[i];
            if (p.isHorizontal) {
                p.gx += p.v * movementScale;
                if ((p.v > 0 && p.gx > w + p.tailLength + 30) || (p.v < 0 && p.gx < -p.tailLength - 30)) {
                    pulses.splice(i, 1);
                    continue;
                }
            } else {
                p.gy += p.v * movementScale;
                if ((p.v > 0 && p.gy > h + p.tailLength + 30) || (p.v < 0 && p.gy < -p.tailLength - 30)) {
                    pulses.splice(i, 1);
                    continue;
                }
            }

            const curr = project(p.gx, p.gy, w, h);
            const tailGx = p.isHorizontal ? p.gx - Math.sign(p.v) * p.tailLength : p.gx;
            const tailGy = p.isHorizontal ? p.gy : p.gy - Math.sign(p.v) * p.tailLength;
            const tail = project(tailGx, tailGy, w, h);

            ctx.globalAlpha = 0.76;
            ctx.lineWidth = 1.25;
            ctx.strokeStyle = cosmic.pulse;
            ctx.beginPath();
            ctx.moveTo(tail.x, tail.y);
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();

            ctx.globalAlpha = 0.18;
            ctx.fillStyle = cosmic.halo;
            ctx.beginPath();
            ctx.arc(curr.x, curr.y, 11, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.92;
            ctx.fillStyle = cosmic.core;
            ctx.beginPath();
            ctx.arc(curr.x, curr.y, 3.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.86;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(curr.x, curr.y, 1.7, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;

        animId = requestAnimationFrame(step);
    }

    window.startAbsCleanGridCircuit = function() {
        if (!animId) {
            animId = requestAnimationFrame(step);
        }
    };

    window.addEventListener('abs-clean-theme-visible', () => {
        window.startAbsCleanGridCircuit();
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && document.body && document.body.classList.contains('theme-abs-clean')) {
            window.startAbsCleanGridCircuit();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body && document.body.classList.contains('theme-abs-clean')) {
                window.startAbsCleanGridCircuit();
            }
        });
    } else {
        if (document.body && document.body.classList.contains('theme-abs-clean')) {
            window.startAbsCleanGridCircuit();
        }
    }
})();
