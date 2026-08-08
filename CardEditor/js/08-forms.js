/* ============================================================
   4. FORM EDITOR LOGIC
   ============================================================ */

window.addFormsSection = function() {
    if (window.guiAddForm) window.guiAddForm();
    else window.addFormBlock();
};

/* --- ULTIMATE FORM MANAGEMENT SYSTEM --- */
window.addFormBlock = function(name = "New Form", blobUrl = "", exportName = "", hubLetter = "") {
    const container = document.getElementById("forms-container");
    if (!container) return;

    // Auto-assign form letters in sequence (a, b, c, d, e...) if not explicitly provided
    const currentCount = container.querySelectorAll(".dokkan-card").length;
    const letterPool = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const defaultLetter = letterPool[currentCount] || 'a';
    const finalLetter = (hubLetter && typeof hubLetter === 'string' && hubLetter.trim()) ? hubLetter.trim().toLowerCase() : defaultLetter;

    // Ensure we don't accidentally use a MouseEvent as a name
    const finalName = (typeof name === 'string' && name !== "") ? name : "New Form";
    const finalSrc = blobUrl || "./images/default.png";
    const dataExport = exportName || "images/default.png";

    const html = `
    <div class="row bg-${currentType} dokkan-card" data-hub-letter="${finalLetter}">
<!-- The inline !important here defeats your global CSS forcing 15px padding -->
<div class="col" style="padding: 8px 0 !important;">
    <div class="row align-items-center m-0 w-100">
        <div class="col-5 d-flex justify-content-center align-items-center">
            <a href="javascript:void(0)" class="form-link" target="_blank">
                <img class="img-fluid form-image" 
                     src="${finalSrc}" 
                     data-export-name="${dataExport}" 
                     style="max-height: 60px; width: auto; display: block;">
            </a>
        </div>
        <div class="col-7 form-name form-name-display d-flex justify-content-center align-items-center" style="color: #fff; font-weight: normal; font-size: 16px; text-align: center; margin: 0;">
            ${finalName}
        </div>
    </div>
</div>
    </div>`;

    container.insertAdjacentHTML('beforeend', html);
    const allForms = container.querySelectorAll(".dokkan-card");
    selectedForm = allForms[allForms.length - 1] || null;
    
    // Preset the link input box for the newly created form
    const linkInput = document.getElementById("formLinkInput");
    if (linkInput) linkInput.value = "https://abscustom.github.io/";

    window.refreshFormList();
    if (window.syncToAbsLayout) window.syncToAbsLayout();
};

window.removeFormBlock = function() {
    const container = document.getElementById("forms-container");
    if (!container) return;
    const forms = container.querySelectorAll(".dokkan-card");
    if (forms.length > 0) {
        forms[forms.length - 1].remove();
        window.refreshFormList();
        if (window.syncToAbsLayout) window.syncToAbsLayout();
    }
};

window.refreshFormList = function() {
    const list = document.getElementById("formList");
    const detailsContainer = document.getElementById("form-editor-details");
    const allForms = document.querySelectorAll("#forms-container .dokkan-card");

    if (!list) return;

    // Show/Hide the editor panel depending on if forms exist
    if (allForms.length === 0) {
        if (detailsContainer) detailsContainer.style.display = 'none';
        list.innerHTML = "";
        return; 
    } else {
        if (detailsContainer) detailsContainer.style.display = 'block';
    }

    list.innerHTML = "";

    allForms.forEach((formRow, i) => {
        // Find the preview elements inside the character card box
        const previewNameDisp = formRow.querySelector(".form-name");
        const previewImg = formRow.querySelector(".form-image");

        const currentName = previewNameDisp ? previewNameDisp.textContent.trim() : `Form ${i+1}`;

        const item = document.createElement("div");
        item.className = "form-list-item";

        // Use exactly the same style/HTML for alignment as your CSS expects
        item.innerHTML = `
            <input type="text" class="list-name-input" value="${currentName}" spellcheck="false">
            <label class="upload-icon" title="Upload Image">
                📥<input type="file" accept="image/*" hidden>
            </label>`;

        const sidebarTextInput = item.querySelector('.list-name-input');
        const sidebarFileInput = item.querySelector("input[type='file']");

        // --- 1. Link Text Editing ---
        sidebarTextInput.addEventListener("input", (e) => {
            if (previewNameDisp) previewNameDisp.textContent = e.target.value;
        });

        // --- 2. Link Image Uploading ---
        sidebarFileInput.addEventListener("change", function() {
            const file = this.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                if (previewImg) {
                    previewImg.src = e.target.result;
                    // Important: if we manually change the image, we remove the scrape-attribute 
                    // so the ZIP exporter knows to take the current image.
                    previewImg.removeAttribute('data-export-name');
                }
            };
            reader.readAsDataURL(file);
        });

        // Highlight selected form logic
        item.addEventListener("click", (e) => {
            if (e.target === sidebarFileInput || e.target.closest('.upload-icon')) return;
            document.querySelectorAll(".form-list-item").forEach(el => el.classList.remove("active"));
            item.classList.add("active");
            selectedForm = formRow; // Keep track of which form we are touching
            
            // Update the Link Input box to match the newly clicked form
            const linkAnchor = selectedForm.querySelector(".form-link");
            const linkInput = document.getElementById("formLinkInput");
            if (linkInput && linkAnchor) {
                const currentHref = linkAnchor.getAttribute("href");
                linkInput.value = (currentHref && currentHref !== "javascript:void(0)") ? currentHref : "https://abscustom.github.io/";
            }
        });

        // Automatically highlight the currently selected form when the list redraws
        if (selectedForm === formRow) {
            item.classList.add("active");
            const linkAnchor = selectedForm.querySelector(".form-link");
            const linkInput = document.getElementById("formLinkInput");
            if (linkInput && linkAnchor) {
                const currentHref = linkAnchor.getAttribute("href");
                linkInput.value = (currentHref && currentHref !== "javascript:void(0)") ? currentHref : "https://abscustom.github.io/";
            }
        }

        list.appendChild(item);
    });
};

window.syncForm = function() {
    if(!selectedForm) return;
    const name = document.getElementById("formNameInput").value;
    const nameDisp = selectedForm.querySelector(".form-name");
    if (nameDisp) nameDisp.textContent = name;
    const activeList = document.querySelector(".form-list-item.active .list-name-input");
    if (activeList) activeList.value = name;
};