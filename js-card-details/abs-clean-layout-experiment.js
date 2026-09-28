/* Compatibility shim for older published cards that still request the former
   presentation script path. New project entry points load the permanent
   ABS.Clean module directly. */
(function () {
    'use strict';

    const legacyScript = document.currentScript;
    const permanentUrl = new URL('./abs-clean-presentation.js?v=20260926-clean-presentation-v38', legacyScript?.src || document.baseURI);
    const permanentPath = new URL('./abs-clean-presentation.js', permanentUrl).pathname;
    const isAlreadyLoaded = Array.from(document.scripts).some(script => {
        if (!script.src) return false;
        try { return new URL(script.src).pathname === permanentPath; }
        catch { return false; }
    });
    if (isAlreadyLoaded) return;

    const loader = document.createElement('script');
    loader.src = permanentUrl.href;
    loader.async = false;
    if (legacyScript?.parentNode) legacyScript.after(loader);
    else document.head.appendChild(loader);
})();
