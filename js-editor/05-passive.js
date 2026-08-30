/* ============================================================
   PASSIVE MANAGER 2.0
   ============================================================ */

// GLOBAL PASSIVE ICON PARSER
window.parsePassiveIcons = function(text) {
    if (!text) return "";
    if (typeof window.formatOfficialText === 'function') {
        return window.formatOfficialText(text, false);
    }
    const icons = {
        // OFFICIAL BRACE TOKENS
        '{passiveImg:up_g}': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_arrow01.png" class="dokkan-icon dokkan-dialog-icon">',
        '{passiveImg:down_r}': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_arrow02.png" class="dokkan-icon dokkan-dialog-icon">',
        '{passiveImg:down_y}': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_arrow03.png" class="dokkan-icon dokkan-dialog-icon">',
        '{passiveImg:once}': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_icon_01.png" class="dokkan-icon dokkan-dialog-icon">',
        '{passiveImg:forever}': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_icon_02.png" class="dokkan-icon dokkan-dialog-icon">',
        '{passiveImg:inf}': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_icon_02.png" class="dokkan-icon dokkan-dialog-icon">',
        '{passiveImg:atk_down}': '<img src="https://abscustom.github.io/assets/images/st_0011.png" class="dokkan-icon dokkan-debuff-icon">',
        '{passiveImg:def_down}': '<img src="https://abscustom.github.io/assets/images/st_0012.png" class="dokkan-icon dokkan-debuff-icon">',
        '{passiveImg:stun}': '<img src="https://abscustom.github.io/assets/images/st_0100.png" class="dokkan-icon dokkan-debuff-icon">',
        '{passiveImg:seal}': '<img src="https://abscustom.github.io/assets/images/st_0102.png" class="dokkan-icon dokkan-debuff-icon">',
        '{passiveImg:astute}': '<img src="https://abscustom.github.io/assets/images/st_0102.png" class="dokkan-icon dokkan-debuff-icon">',
        '{passiveImg:break}': '<img src="https://abscustom.github.io/assets/images/st_1009.png" class="dokkan-icon dokkan-debuff-icon">',

        // DIALOG ARROWS & ICONS
        ':up:': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_arrow01.png" class="dokkan-icon dokkan-dialog-icon">',
        ':down:': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_arrow02.png" class="dokkan-icon dokkan-dialog-icon">',
        ':ydown:': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_arrow03.png" class="dokkan-icon dokkan-dialog-icon">',
        ':once:': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_icon_01.png" class="dokkan-icon dokkan-dialog-icon">',
        ':inf:': '<img src="https://abscustom.github.io/assets/images/passive_skill_dialog_icon_02.png" class="dokkan-icon dokkan-dialog-icon">',
        
        // DEBUFF STAT ICONS
        ':atk_down:': '<img src="https://abscustom.github.io/assets/images/st_0011.png" class="dokkan-icon dokkan-debuff-icon">',
        ':def_down:': '<img src="https://abscustom.github.io/assets/images/st_0012.png" class="dokkan-icon dokkan-debuff-icon">',
        ':stun:': '<img src="https://abscustom.github.io/assets/images/st_0100.png" class="dokkan-icon dokkan-debuff-icon">',
        ':seal:': '<img src="https://abscustom.github.io/assets/images/st_0102.png" class="dokkan-icon dokkan-debuff-icon">',
        ':astute:': '<img src="https://abscustom.github.io/assets/images/st_0102.png" class="dokkan-icon dokkan-debuff-icon">',
        ':break:': '<img src="https://abscustom.github.io/assets/images/st_1009.png" class="dokkan-icon dokkan-debuff-icon">',

        // SPECIAL IN-GAME ABILITY ICONS
        ':atk_up:': '<img src="https://abscustom.github.io/assets/images/st_0001.png" class="dokkan-icon dokkan-debuff-icon">',
        ':def_up:': '<img src="https://abscustom.github.io/assets/images/st_0002.png" class="dokkan-icon dokkan-debuff-icon">',
        ':ki_up:': '<img src="https://abscustom.github.io/assets/images/st_0003.png" class="dokkan-icon dokkan-debuff-icon">',
        ':crit:': '<img src="https://abscustom.github.io/assets/images/st_critical_up.png" class="dokkan-icon dokkan-debuff-icon">',
        ':add_atk:': '<img src="https://abscustom.github.io/assets/images/st_atk_combo.png" class="dokkan-icon dokkan-debuff-icon">',
        ':effective:': '<img src="https://abscustom.github.io/assets/images/st_atk_super.png" class="dokkan-icon dokkan-debuff-icon">',
        ':always_hit:': '<img src="https://abscustom.github.io/assets/images/st_always_hit.png" class="dokkan-icon dokkan-debuff-icon">',
        ':guard:': '<img src="https://abscustom.github.io/assets/images/st_guard_all.png" class="dokkan-icon dokkan-debuff-icon">',
        ':dmg_red:': '<img src="https://abscustom.github.io/assets/images/st_resist_damage_up.png" class="dokkan-icon dokkan-debuff-icon">',
        ':evasion:': '<img src="https://abscustom.github.io/assets/images/st_evasion.png" class="dokkan-icon dokkan-debuff-icon">',
        ':disable_guard:': '<img src="https://abscustom.github.io/assets/images/st_disable_guard.png" class="dokkan-icon dokkan-debuff-icon">',
        ':rainbow_ki:': '<img src="https://abscustom.github.io/assets/images/ki_change_rainbow.png" class="dokkan-icon dokkan-debuff-icon">',
        ':heal:': '<img src="https://abscustom.github.io/assets/images/st_recover.png" class="dokkan-icon dokkan-debuff-icon">',
        ':revive:': '<img src="https://abscustom.github.io/assets/images/st_revive.png" class="dokkan-icon dokkan-debuff-icon">',
        ':survive_ko:': '<img src="https://abscustom.github.io/assets/images/st_invalid_ko.png" class="dokkan-icon dokkan-debuff-icon">',
        ':taunt:': '<img src="https://abscustom.github.io/assets/images/st_target.png" class="dokkan-icon dokkan-debuff-icon">',
        ':counter:': '<img src="https://abscustom.github.io/assets/images/st_counter.png" class="dokkan-icon dokkan-debuff-icon">',
        ':reversible:': '<img src="https://abscustom.github.io/assets/images/st_reversible.png" class="dokkan-icon dokkan-debuff-icon">'
    };
    let out = text;
    for (const [code, img] of Object.entries(icons)) { 
        out = out.split(code).join(img); 
    }
    return out;
};

function passiveEditorTextFromNode(node) {
    if (!node) return "";
    const clone = node.cloneNode(true);
    const tokenByFile = {
        'passive_skill_dialog_arrow01.png': ':up:',
        'passive_skill_dialog_arrow02.png': ':down:',
        'passive_skill_dialog_arrow03.png': ':ydown:',
        'passive_skill_dialog_icon_01.png': ':once:',
        'passive_skill_dialog_icon_02.png': ':inf:',
        'st_0001.png': ':atk_up:',
        'st_0002.png': ':def_up:',
        'st_0003.png': ':ki_up:',
        'st_0011.png': ':atk_down:',
        'st_0012.png': ':def_down:',
        'st_0100.png': ':stun:',
        'st_0102.png': ':seal:',
        'st_1009.png': ':break:',
        'st_critical_up.png': ':crit:',
        'st_atk_combo.png': ':add_atk:',
        'st_atk_super.png': ':effective:',
        'st_always_hit.png': ':always_hit:',
        'st_guard_all.png': ':guard:',
        'st_resist_damage_up.png': ':dmg_red:',
        'st_evasion.png': ':evasion:',
        'st_disable_guard.png': ':disable_guard:',
        'ki_change_rainbow.png': ':rainbow_ki:',
        'st_recover.png': ':heal:',
        'st_revive.png': ':revive:',
        'st_invalid_ko.png': ':survive_ko:',
        'st_target.png': ':taunt:',
        'st_counter.png': ':counter:',
        'st_reversible.png': ':reversible:'
    };

    clone.querySelectorAll('img').forEach(img => {
        const fileName = (img.getAttribute('src') || '').split(/[?#]/)[0].split('/').pop();
        img.replaceWith(document.createTextNode(tokenByFile[fileName] || img.getAttribute('alt') || ''));
    });
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
}

function syncPassiveSectionCounter() {
    const ids = Array.from(document.querySelectorAll('#sidebar-sections-area [id^="side-sec-"]'))
        .map(sec => parseInt(sec.id.replace('side-sec-', ''), 10))
        .filter(Number.isFinite);
    const highestId = ids.length ? Math.max(...ids) : 0;
    sIdx = highestId;
    window.sIdx = highestId;
    return highestId;
}

// Older published pages remove the hidden editor sidebar. Rebuild it from the
// visible passive sections so imported cards remain fully editable.
window.ensurePassiveEditorSections = function() {
    const sidebarArea = document.getElementById('sidebar-sections-area');
    const cardArea = document.getElementById('card-passive-container');
    if (!sidebarArea || !cardArea) return 0;

    const existingSections = sidebarArea.querySelectorAll('[id^="side-sec-"]');
    const existingHasContent = Array.from(existingSections).some(section => {
        const textarea = section.querySelector('textarea');
        return String(textarea?.value || textarea?.textContent || textarea?.getAttribute('value') || '').trim() !== '';
    });
    if (existingSections.length > 0 && existingHasContent) {
        syncPassiveSectionCounter();
        return existingSections.length;
    }

    const sources = [cardArea, document.getElementById('abs-passive-container')].filter(Boolean);
    const sectionData = [];
    for (const source of sources) {
        source.querySelectorAll('strong').forEach(header => {
            let list = header.nextElementSibling;
            while (list && list.tagName !== 'UL' && list.tagName !== 'STRONG') list = list.nextElementSibling;
            const bullets = list?.tagName === 'UL'
                ? Array.from(list.querySelectorAll('li')).map(passiveEditorTextFromNode).filter(Boolean)
                : [];
            const headerText = passiveEditorTextFromNode(header) || 'Basic effect(s)';
            if (bullets.length > 0 || headerText) sectionData.push({ header: headerText, bullets });
        });
        if (sectionData.length > 0) break;

        const looseBullets = Array.from(source.querySelectorAll('li')).map(passiveEditorTextFromNode).filter(Boolean);
        if (looseBullets.length > 0) {
            sectionData.push({ header: 'Basic effect(s)', bullets: looseBullets });
            break;
        }
    }

    if (sectionData.length === 0) return 0;

    cardArea.innerHTML = '';
    sidebarArea.innerHTML = '';
    sIdx = 0;
    window.sIdx = 0;

    sectionData.forEach(section => {
        window.addNewSection();
        const currentId = sIdx;
        const headerInput = document.getElementById(`input-sec-hdr-${currentId}`);
        const textInput = document.getElementById(`input-sec-${currentId}`);
        const text = section.bullets.map(line => `- ${line}`).join('\n');
        if (headerInput) headerInput.value = section.header;
        if (textInput) textInput.value = text;
        window.updateHeader(currentId, section.header);
        window.updateSection(currentId, text);
    });

    window.sIdx = sIdx;
    if (window.syncToAbsLayout) window.syncToAbsLayout();
    return sectionData.length;
};

window.updatePassiveName = function(val) {
    const passiveDisplay = document.querySelector('.passive-name-display');
    if (passiveDisplay) passiveDisplay.innerText = val;

    const sidebarInput = document.getElementById('input-passive-name-sidebar');
    if (sidebarInput && sidebarInput.value !== val) sidebarInput.value = val;

    const guiInput = document.getElementById('gui-passive-name');
    if (guiInput && guiInput.value !== val) guiInput.value = val;

    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.toggleSectionCollapse = function(id, btn) {
    const content = document.getElementById("side-content-" + id);
    if (!content) return;
    const isHidden = content.style.display === "none" || content.classList.contains("d-none");
    if (isHidden) {
        content.style.display = "block";
        content.classList.remove("d-none");
        if (btn) { btn.innerText = "−"; btn.title = "Collapse Section"; }
    } else {
        content.style.display = "none";
        content.classList.add("d-none");
        if (btn) { btn.innerText = "+"; btn.title = "Expand Section"; }
    }
};

window.confirmDeleteSection = function(btn, id) {
    if (btn.innerText === '×') {
        btn.innerText = '?'; 
        btn.style.background = '#facc15'; 
        btn.style.color = '#000'; 
        btn.title = "Click again to confirm delete";
        setTimeout(() => {
            if (btn && btn.innerText === '?') {
                btn.innerText = '×';
                btn.style.background = '#ef4444';
                btn.style.color = '#fff';
                btn.title = "Delete";
            }
        }, 3000);
    } else {
        window.removeThisSection(id);
    }
};

window.reindexSections = function() {
    const sidebarArea = document.getElementById("sidebar-sections-area");
    if (!sidebarArea) return;
    
    const sections = sidebarArea.querySelectorAll('[id^="side-sec-"]');
    sections.forEach((sec, index) => {
        const label = sec.querySelector('b');
        if (label) label.innerText = `SECTION ${index + 1}`;
    });

    if (window.currentCardThemeStyle === 'abs-style' && window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.addNewSection = function() {
    sIdx++;
    document.getElementById('card-passive-container').insertAdjacentHTML('beforeend', 
        `<div id="card-sec-${sIdx}"><strong id="card-header-text-${sIdx}" style="display:block; margin-top:0px;">Basic effect(s)</strong><ul id="card-ul-${sIdx}"></ul></div>`);
    
    document.getElementById('sidebar-sections-area').insertAdjacentHTML('beforeend', `
        <div id="side-sec-${sIdx}" style="background:#27272a; border:1px solid #3f3f46; padding:10px; margin-top:10px; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <b style="font-size: 12px; color: #a1a1aa; cursor:pointer;" onclick="toggleSectionCollapse(${sIdx}, document.getElementById('side-toggle-btn-${sIdx}'))">SECTION ${sIdx}</b>
                <div style="display:flex; gap: 4px;">
                    <button id="side-toggle-btn-${sIdx}" class="gui-minimize-btn" onclick="toggleSectionCollapse(${sIdx}, this)" title="Collapse Section">−</button>
                    <button class="gui-minimize-btn" onclick="moveSection(${sIdx}, -1)" title="Move Up">↑</button>
                    <button class="gui-minimize-btn" onclick="moveSection(${sIdx}, 1)" title="Move Down">↓</button>
                    <button onclick="confirmDeleteSection(this, ${sIdx})" title="Delete" style="background:#ef4444; color:white; border:none; width:22px; height:22px; font-size:12px; cursor:pointer; font-weight:bold; border-radius:3px; display:flex; justify-content:center; align-items:center;">×</button>
                </div>
            </div>
            <div id="side-content-${sIdx}">
                <!-- Header Input & Header Debuff Shortcuts -->
                <div style="margin-top:6px; margin-bottom:4px;">
                    <input type="text" id="input-sec-hdr-${sIdx}" oninput="updateHeader(${sIdx}, this.value)" value="Basic effect(s)" class="form-control form-control-sm mb-1">
                    <div style="display:flex; gap:3px; width:100%; flex-wrap:wrap; margin-bottom:6px;">
                        <span style="font-size:9px; color:#888; align-self:center; font-weight:bold; margin-right:2px;">Header:</span>
                        <button onclick="insertShortcut('input-sec-hdr-${sIdx}', ':atk_down:')" title="ATK Down" style="font-size:9px; padding:1px 4px; background:#1e293b; color:#f87171; border:1px solid #ef4444; border-radius:3px; cursor:pointer;">ATK↓</button>
                        <button onclick="insertShortcut('input-sec-hdr-${sIdx}', ':def_down:')" title="DEF Down" style="font-size:9px; padding:1px 4px; background:#1e293b; color:#38bdf8; border:1px solid #3b82f6; border-radius:3px; cursor:pointer;">DEF↓</button>
                        <button onclick="insertShortcut('input-sec-hdr-${sIdx}', ':stun:')" title="Stun" style="font-size:9px; padding:1px 4px; background:#1e293b; color:#facc15; border:1px solid #eab308; border-radius:3px; cursor:pointer;">Stun</button>
                        <button onclick="insertShortcut('input-sec-hdr-${sIdx}', ':seal:')" title="Seal" style="font-size:9px; padding:1px 4px; background:#1e293b; color:#c084fc; border:1px solid #a855f7; border-radius:3px; cursor:pointer;">Seal</button>
                        <button onclick="insertShortcut('input-sec-hdr-${sIdx}', ':break:')" title="Action Break" style="font-size:9px; padding:1px 4px; background:#1e293b; color:#fb923c; border:1px solid #f97316; border-radius:3px; cursor:pointer;">Break</button>
                    </div>
                </div>

                <textarea id="input-sec-${sIdx}" oninput="updateSection(${sIdx}, this.value)" class="form-control form-control-sm mb-2" rows="6" placeholder="Type effects here... Press Enter for a new line.">- New effect...</textarea>
                
                <!-- Text Area Shortcuts: Dialog Icons -->
                <div style="display:flex; gap: 3px; width: 100%; flex-wrap:wrap; margin-bottom:3px;">
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':up:')" title="Green Up Arrow" class="btn-icon-tool" style="color:#00ffcc; font-size: 12px; padding: 2px 4px; flex: 1;">↑</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':down:')" title="Self debuff arrow" class="btn-icon-tool" style="color:#ff4444; font-size: 12px; padding: 2px 4px; flex: 1;">↓</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':ydown:')" title="Enemy debuff arrow" class="btn-icon-tool" style="color:#FFFF00; font-size: 12px; padding: 2px 4px; flex: 1;">↓</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':once:')" title="Once only" class="btn-icon-tool" style="font-size: 12px; padding: 2px 4px; flex: 1;">!</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':inf:')" title="Infinite" class="btn-icon-tool" style="font-size: 12px; padding: 2px 4px; flex: 1;">∞</button>
                </div>
                <!-- Text Area Shortcuts: Debuffs -->
                <div style="display:flex; gap: 3px; width: 100%; flex-wrap:wrap;">
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':atk_down:')" title="ATK Down" class="btn-icon-tool" style="color:#f87171; font-size: 9.5px; font-weight:bold; padding: 2px 4px; flex: 1; border-color:#ef4444;">ATK↓</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':def_down:')" title="DEF Down" class="btn-icon-tool" style="color:#38bdf8; font-size: 9.5px; font-weight:bold; padding: 2px 4px; flex: 1; border-color:#3b82f6;">DEF↓</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':stun:')" title="Stun" class="btn-icon-tool" style="color:#facc15; font-size: 9.5px; font-weight:bold; padding: 2px 4px; flex: 1; border-color:#eab308;">Stun</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':seal:')" title="Seal" class="btn-icon-tool" style="color:#c084fc; font-size: 9.5px; font-weight:bold; padding: 2px 4px; flex: 1; border-color:#a855f7;">Seal</button>
                    <button onclick="insertShortcut('input-sec-${sIdx}', ':break:')" title="Action Break" class="btn-icon-tool" style="color:#fb923c; font-size: 9.5px; font-weight:bold; padding: 2px 4px; flex: 1; border-color:#f97316;">Break</button>
                </div>
            </div>
        </div>`);
        
    window.updateSection(sIdx, "- New effect...");
    window.reindexSections();
};

window.updateHeader = function(id, val) {
    const el = document.getElementById("card-header-text-" + id);
    if (el) {
        el.innerHTML = window.parsePassiveIcons(val);
    }
    const input = document.querySelector(`#side-sec-${id} input[type="text"]`);
    if (input) input.setAttribute('value', val);

    if (window.currentCardThemeStyle === 'abs-style' && window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.insertShortcut = function(targetId, code) {
    const ta = document.getElementById(targetId);
    if (!ta) return;
    const startPos = ta.selectionStart || 0;
    const endPos = ta.selectionEnd || 0;
    const text = ta.value;
    ta.value = text.substring(0, startPos) + code + text.substring(endPos);
    ta.selectionStart = ta.selectionEnd = startPos + code.length;
    ta.focus();
    
    if (targetId.startsWith('input-sec-hdr-')) {
        const sectionId = targetId.replace('input-sec-hdr-', '');
        window.updateHeader(sectionId, ta.value);
    } else if (targetId.startsWith('gui-sec-header-')) {
        const sectionId = targetId.replace('gui-sec-header-', '');
        const origHeader = document.querySelector(`#side-sec-${sectionId} input[type="text"]`);
        if (origHeader) origHeader.value = ta.value;
        window.updateHeader(sectionId, ta.value);
    } else if (targetId.startsWith('input-sec-')) {
        const sectionId = targetId.replace('input-sec-', '');
        window.updateSection(sectionId, ta.value);
    } else if (targetId.startsWith('gui-sec-text-')) {
        const sectionId = targetId.replace('gui-sec-text-', '');
        const origTa = document.getElementById(`input-sec-${sectionId}`);
        if (origTa) origTa.value = ta.value;
        window.updateSection(sectionId, ta.value);
    }
    if (window.currentCardThemeStyle === 'abs-style' && window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.updateSection = function(id, val) {
    const ta = document.getElementById(`input-sec-${id}`);
    if (ta) {
        ta.textContent = val;
        ta.setAttribute('value', val);
    }
    let out = window.parsePassiveIcons(val);
    const lines = out.split('\n');
    let html = "";
    lines.forEach(line => {
        let trimmed = line.trim();
        if (trimmed.startsWith('-')) trimmed = trimmed.substring(1).trim();
        if (trimmed !== "") html += `<li>${trimmed}</li>`;
    });
    const ul = document.getElementById("card-ul-" + id);
    if (ul) ul.innerHTML = html;

    if (window.currentCardThemeStyle === 'abs-style' && window.syncToAbsLayout) {
        window.syncToAbsLayout();
    }
};

window.removeThisSection = function(id) {
    document.getElementById("card-sec-" + id)?.remove();
    document.getElementById("side-sec-" + id)?.remove();
    window.reindexSections(); 
};
