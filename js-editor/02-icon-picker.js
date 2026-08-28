/* ============================================================
   MODAL ICON PICKER ENGINE
   ============================================================ */
window.iconPickerResolve = null;
window.selectedIcons = [];
window.expectedIconCount = 2;

window.openIconPicker = function(thumbs, isLR) {
    return new Promise((resolve) => {
        window.iconPickerResolve = resolve;
        window.selectedIcons = [];
        window.expectedIconCount = isLR ? 3 : 2;

        const grid = document.getElementById('icon-picker-grid');
        grid.innerHTML = "";
        
        const uniqueUrls = [...new Set(thumbs.map(t => t.url))];
        uniqueUrls.forEach(url => {
            const img = document.createElement('img');
            img.src = `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//i, ''))}&w=100`;
            img.onclick = () => window.selectIconForSlot(url, img);
            grid.appendChild(img);
        });

        document.getElementById('icon-picker-modal').style.display = 'flex';
        window.updateIconPickerInstruction();
    });
};

window.selectIconForSlot = function(originalUrl, imgElement) {
    window.selectedIcons.push(originalUrl);
    imgElement.style.borderColor = "#3b82f6";
    imgElement.style.opacity = "0.4";
    imgElement.onclick = null;

    if (window.selectedIcons.length >= window.expectedIconCount) {
        document.getElementById('icon-picker-modal').style.display = 'none';
        window.iconPickerResolve(window.selectedIcons);
    } else {
        window.updateIconPickerInstruction();
    }
};

window.updateIconPickerInstruction = function() {
    const instr = document.getElementById('icon-picker-instruction');
    const step = window.selectedIcons.length;
    if (step === 0) instr.innerHTML = "Please click the <b>SSR</b> Icon";
    else if (step === 1) instr.innerHTML = "Please click the <b>TUR</b> Icon";
    else if (step === 2) instr.innerHTML = "Please click the <b>LR</b> Icon";
};

window.skipIconSelection = function() {
    document.getElementById('icon-picker-modal').style.display = 'none';
    window.iconPickerResolve([]);
};


