/* ==========================================================================
   absCustom - Linking Partners Calculation & Filtering Engine
   ========================================================================== */

function renderLinkingPartners(card) {
    const partnersBox = document.getElementById("abs-partners-box");
    const partnersContainer = document.getElementById("abs-partners-container");
    if (!partnersBox || !partnersContainer || !DB.cards) return;

    const normalizeLinkName = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const cardLinks = (card.links || card.link_skill_ids || []).map(l => {
        if (typeof l === 'object') return l.name;
        if (DB.links && DB.links[l]) return DB.links[l].name;
        return l;
    }).map(link => String(link || '').trim()).filter(Boolean);
    const cardLinksByKey = new Map(cardLinks.map(link => [normalizeLinkName(link), link]));

    if (!cardLinks || cardLinks.length === 0) {
        partnersBox.style.display = "none";
        return;
    }

    const cardFolder = getCardFolderId(card);
    const bestPartnerByCharacter = new Map();
    const mainCardName = (card.name || '').trim().toLowerCase();

    DB.cards.forEach(otherCard => {
        if (otherCard.id === card.id || Number(otherCard.rarity) === 3) return;

        const otherCardName = (otherCard.name || '').trim().toLowerCase();
        if (mainCardName && otherCardName && mainCardName === otherCardName) return;

        const otherFolder = getCardFolderId(otherCard);
        if (otherFolder === cardFolder) return;

        const otherLinks = (otherCard.links || otherCard.link_skill_ids || []).map(l => {
            if (typeof l === 'object') return l.name;
            if (DB.links && DB.links[l]) return DB.links[l].name;
            return l;
        }).map(link => normalizeLinkName(link)).filter(Boolean);
        const otherLinkKeys = new Set(otherLinks);

        if (!otherLinks || otherLinks.length === 0) return;

        const sharedLinks = [];
        cardLinksByKey.forEach((displayName, key) => {
            if (otherLinkKeys.has(key)) sharedLinks.push(displayName);
        });

        if (sharedLinks.length >= 4) {
            let totalBuffs = { atk: 0, def: 0, ki: 0, hp: 0, enemyDef: 0 };
            sharedLinks.forEach(linkName => {
                let linkObj = DB.links ? Object.values(DB.links).find(l => l.name === linkName) : null;
                let b = getLinkSkillBuffs(linkName, linkObj);
                if (b.atk) totalBuffs.atk += b.atk;
                if (b.def) totalBuffs.def += b.def;
                if (b.ki) totalBuffs.ki += b.ki;
                if (b.hp) totalBuffs.hp += b.hp;
                if (b.enemyDef) totalBuffs.enemyDef += b.enemyDef;
            });

            const releaseTime = new Date((otherCard.open_at || otherCard.release_date || '').replace(" ", "T") + "Z").getTime() || otherCard.id;
            const isTransformation = typeof isTransformedCard === 'function'
                ? isTransformedCard(otherCard)
                : otherCard.is_transform === true;
            const characterId = parseInt(otherCard.character_id || otherCard.characterId, 10) || 0;

            // Character IDs identify the same character/form across different releases.
            // Keep transformed versions separate so a base card and its form can both appear.
            const partnerKey = characterId
                ? `character-${characterId}-${isTransformation ? 'transformed' : 'base'}`
                : `family-${otherFolder}`;
            const candidate = {
                card: otherCard, 
                sharedCount: sharedLinks.length, 
                sharedLinks, 
                buffs: totalBuffs,
                releaseTime
            };
            const existing = bestPartnerByCharacter.get(partnerKey);
            const candidateRarity = parseInt(otherCard.rarity, 10) || 0;
            const existingRarity = existing ? (parseInt(existing.card.rarity, 10) || 0) : -1;
            const candidateUpgradeRank = otherCard.is_seza ? 2 : (otherCard.is_eza ? 1 : 0);
            const existingUpgradeRank = existing
                ? (existing.card.is_seza ? 2 : (existing.card.is_eza ? 1 : 0))
                : -1;

            // Only one release of the same character/form is shown: highest rarity
            // first, then its strongest upgrade (SEZA/EZA), then the newest release.
            if (!existing ||
                candidateRarity > existingRarity ||
                (candidateRarity === existingRarity && candidateUpgradeRank > existingUpgradeRank) ||
                (candidateRarity === existingRarity && candidateUpgradeRank === existingUpgradeRank && releaseTime > existing.releaseTime)) {
                bestPartnerByCharacter.set(partnerKey, candidate);
            }
        }
    });

    const partnerScores = [...bestPartnerByCharacter.values()];
    partnerScores.sort((a, b) => b.sharedCount - a.sharedCount || b.releaseTime - a.releaseTime);

    window.allPartnerScores = partnerScores;
    filterLinkingPartners();
}

function filterLinkingPartners() {
    const partnersBox = document.getElementById("abs-partners-box");
    const partnersContainer = document.getElementById("abs-partners-container");

    // Uploaded cards are standalone HTML snapshots. Upgrade the old button
    // markup at runtime so existing cards adopt the 9-card row increments
    // without needing to be uploaded again.
    const partnerLimitButtons = Array.from(document.querySelectorAll('.partner-limit-btn'));
    const oldLimits = [10, 20, 30, 40, 50];
    const rowLimits = [9, 18, 27, 36, 45];
    const hasLegacyLimits = partnerLimitButtons.length === oldLimits.length &&
        partnerLimitButtons.every((button, index) => Number(button.textContent.trim()) === oldLimits[index]);
    if (hasLegacyLimits) {
        partnerLimitButtons.forEach((button, index) => {
            const limit = rowLimits[index];
            button.textContent = String(limit);
            button.setAttribute('onclick', `setPartnerLimit(${limit}, this)`);
        });
    }

    // The active button is the source of truth for the initial view. This
    // keeps older published pages from rendering the former default of 10
    // when their first visible choice is now 9.
    const activeLimitButton = document.querySelector('.partner-limit-btn.active');
    const activeLimit = Number(activeLimitButton?.textContent?.trim());
    if (Number.isFinite(activeLimit) && activeLimit > 0) {
        currentPartnerLimit = activeLimit;
    }

    if (!window.allPartnerScores || window.allPartnerScores.length === 0) {
        if (partnersBox) partnersBox.style.display = "none";
        return;
    }

    const displayList = window.allPartnerScores.slice(0, currentPartnerLimit);

    partnersBox.style.display = "block";
    partnersContainer.innerHTML = displayList.map(({ card: pCard, sharedCount, buffs }) => {
        let pillsHtml = [];

        if (buffs.atk > 0) {
            pillsHtml.push(`<span class="partner-stat-pill pill-red"><img src="${CENTRAL_ASSET_URL}st_0001.png"> +${buffs.atk}%</span>`);
        }
        if (buffs.def > 0) {
            pillsHtml.push(`<span class="partner-stat-pill pill-blue"><img src="${CENTRAL_ASSET_URL}st_0002.png"> +${buffs.def}%</span>`);
        }

        let subRowPills = [];
        if (buffs.ki > 0) {
            subRowPills.push(`<span class="partner-stat-pill pill-yellow"><img src="${CENTRAL_ASSET_URL}st_0003.png"> +${buffs.ki}</span>`);
        }
        if (buffs.hp > 0) {
            subRowPills.push(`<span class="partner-stat-pill pill-green"><img src="${CENTRAL_ASSET_URL}st_recover.png"> +${buffs.hp}%</span>`);
        }
        if (buffs.enemyDef < 0) {
            subRowPills.push(`<span class="partner-stat-pill pill-orange"><img src="${CENTRAL_ASSET_URL}st_0012.png"> ${buffs.enemyDef}%</span>`);
        }

        return `
            <a href="card.html?id=${pCard.id}" class="partner-card-wrapper" title="${pCard.name}">
                <div class="partner-icon-relative">
                    ${buildComposedIcon(pCard, pCard.rarity === 3, 'base')}
                    <span class="partner-links-count-tag">${sharedCount} Links</span>
                </div>
                <div class="partner-pills-container">
                    ${pillsHtml.length > 0 ? `<div class="partner-pill-row">${pillsHtml.join('')}</div>` : ''}
                    ${subRowPills.length > 0 ? `<div class="partner-pill-row">${subRowPills.join('')}</div>` : ''}
                </div>
            </a>
        `;
    }).join('');
}

function setPartnerLimit(limit, btnEl) {
    currentPartnerLimit = limit;
    document.querySelectorAll('.partner-limit-btn').forEach(btn => btn.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    filterLinkingPartners();
}
