/* ============================================================
   4. FORM EDITOR LOGIC
   ============================================================ */

window.addFormsSection = function() {
    try {
        window.addFormBlock();
        if (typeof window.openContextGUI === 'function') window.openContextGUI(0, 0, 'forms');
    } catch (error) {
        console.error('Could not add transformation form:', error);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const addButton = document.getElementById('add-forms-sidebar-btn');
    if (addButton && addButton.dataset.formHandlerBound !== 'true') {
        addButton.dataset.formHandlerBound = 'true';
        addButton.addEventListener('click', window.addFormsSection);
    }
});

/* --- ULTIMATE FORM MANAGEMENT SYSTEM --- */
window.addFormBlock = function(name = "New Form", blobUrl = "", exportName = "", absThumbSrc = "") {
    const container = document.getElementById("forms-container");
    if (!container) return;

    // Ensure we don't accidentally use a MouseEvent as a name
    const finalName = (typeof name === 'string' && name !== "") ? name : "New Form";
    const finalSrc = blobUrl || "https://abscustom.github.io/assets/images/default.png";
    const finalThumbSrc = absThumbSrc || finalSrc;
    const dataExport = exportName || "images/default.png";

    const html = `
    <div class="row bg-${currentType} dokkan-card">
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
    if (selectedForm) selectedForm.setAttribute('data-thumb-src', finalThumbSrc);
    
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

    const formsWrapper = document.getElementById("forms-card-wrapper");
    if (formsWrapper) formsWrapper.style.display = (allForms.length > 0) ? 'block' : 'none';
    const transBox = document.getElementById('abs-transformations-box');
    if (transBox) transBox.classList.toggle('d-none', allForms.length === 0);

    // Show/Hide the editor panel depending on if forms exist
    if (allForms.length === 0) {
        if (detailsContainer) detailsContainer.style.display = 'none';
        if (list) list.innerHTML = "";
        return; 
    } else {
        if (detailsContainer) detailsContainer.style.display = 'block';
    }

    // The click-to-edit UI replaced the old formList sidebar. Visibility and
    // ABS synchronization must still work when that legacy list is absent.
    if (!list) return;

    list.innerHTML = "";

    allForms.forEach((formRow, i) => {
        // Hub letters are obsolete now that transformations use direct card links.
        formRow.removeAttribute('data-hub-letter');
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
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="display:inline-block; vertical-align:middle;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg><input type="file" accept="image/*" hidden>
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
                    if (!formRow.hasAttribute('data-thumb-src')) {
                        formRow.setAttribute('data-thumb-src', previewImg.getAttribute('src') || previewImg.src || '');
                    }
                    previewImg.src = e.target.result;
                    // Important: if we manually change the image, we remove the scrape-attribute 
                    // so the ZIP exporter knows to take the current image.
                    previewImg.removeAttribute('data-export-name');
                    if (window.syncToAbsLayout) window.syncToAbsLayout();
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
