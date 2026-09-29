(function registerPublishedCardGuards(root) {
    const executableScriptTypes = new Set([
        '',
        'application/ecmascript',
        'application/javascript',
        'application/x-javascript',
        'text/ecmascript',
        'text/javascript',
        'text/jscript'
    ]);

    function readAttribute(attributes, name) {
        const match = String(attributes || '').match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
        return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
    }

    function assertGeneratedInlineScripts(html, sourceName = 'generated HTML') {
        const source = String(html || '');
        const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
        let match;
        let scriptNumber = 0;
        let validatedCount = 0;

        while ((match = scriptPattern.exec(source))) {
            scriptNumber += 1;
            const scriptSource = match[2] || '';
            if (!scriptSource.trim()) continue;

            const rawType = readAttribute(match[1], 'type').trim().toLowerCase();
            const scriptType = rawType.split(';', 1)[0].trim();
            if (scriptType === 'module') {
                throw new SyntaxError(`${sourceName}: inline module script #${scriptNumber} cannot be validated safely; use an external module script.`);
            }
            if (scriptType && !executableScriptTypes.has(scriptType)) continue;

            try {
                // Function construction parses the source without executing it.
                new Function(scriptSource);
            } catch (error) {
                const syntaxError = new SyntaxError(`${sourceName}: inline script #${scriptNumber} has invalid JavaScript: ${error.message}`);
                syntaxError.cause = error;
                throw syntaxError;
            }
            validatedCount += 1;
        }

        return validatedCount;
    }

    function buildPublishedLoaderWatchdogScript() {
        return `
(function() {
    var readyEvent = 'abs-card-content-ready';
    var failed = false;
    var timeoutId = window.setTimeout(function() {
        showFailure('The card did not finish starting. Check your connection, then retry.');
    }, 15000);

    function showFailure(message) {
        if (failed || window.absCardContentReady) return;
        var screen = document.getElementById('abs-loading-screen');
        if (!screen) return;
        failed = true;
        window.clearTimeout(timeoutId);
        screen.classList.remove('is-hidden', 'is-entering', 'is-exiting', 'is-complete');
        screen.dataset.loaderError = 'true';
        screen.setAttribute('role', 'alert');
        screen.setAttribute('aria-label', 'Card could not be loaded');
        screen.style.setProperty('position', 'fixed', 'important');
        screen.style.setProperty('inset', '0', 'important');
        screen.style.setProperty('z-index', '2147483647', 'important');
        screen.style.setProperty('display', 'grid', 'important');
        screen.style.setProperty('place-items', 'center', 'important');
        screen.style.setProperty('visibility', 'visible', 'important');
        screen.style.setProperty('opacity', '1', 'important');
        screen.style.setProperty('pointer-events', 'auto', 'important');
        screen.style.setProperty('background', '#03060c', 'important');
        screen.style.setProperty('color', '#fff', 'important');

        var panel = document.createElement('div');
        panel.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;max-width:460px;padding:28px;text-align:center;font-family:system-ui,sans-serif';
        var title = document.createElement('h1');
        title.textContent = 'Card could not load';
        title.style.cssText = 'margin:0;color:#fff;font-size:22px;line-height:1.2';
        var detail = document.createElement('p');
        detail.textContent = message || 'A required card script failed to start. Check your connection, then retry.';
        detail.style.cssText = 'margin:0;color:#cbd5e1;font-size:14px;line-height:1.5';
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.setAttribute('aria-label', 'Retry loading this card');
        retry.style.cssText = 'margin-top:4px;padding:10px 22px;border:1px solid #94a3b8;border-radius:6px;background:#172033;color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer';
        retry.addEventListener('click', function() { window.location.reload(); });
        panel.append(title, detail, retry);
        screen.replaceChildren(panel);
        document.documentElement.classList.remove('abs-page-loading');
    }

    window.addEventListener(readyEvent, function() {
        window.clearTimeout(timeoutId);
        if (failed) document.getElementById('abs-loading-screen')?.remove();
    }, { once: true });
    window.addEventListener('abs-card-bootstrap-error', function() {
        showFailure('A required card script failed to start. Check your connection, then retry.');
    }, { once: true });
    window.addEventListener('error', function(event) {
        if (window.absCardContentReady) return;
        var message = String(event.message || '');
        if (event.error?.name === 'SyntaxError' || /syntaxerror|unexpected end of input|invalid or unexpected token|unterminated string/i.test(message)) {
            window.setTimeout(function() {
                showFailure('The card startup script could not be read. Refresh and retry.');
            }, 0);
        }
    }, true);
    window.addEventListener('unhandledrejection', function() {
        if (!window.absCardContentReady) {
            window.setTimeout(function() {
                showFailure('A required card script failed to start. Check your connection, then retry.');
            }, 0);
        }
    }, true);
})();
        `.trim();
    }

    root.assertGeneratedInlineScripts = assertGeneratedInlineScripts;
    root.buildPublishedLoaderWatchdogScript = buildPublishedLoaderWatchdogScript;
})(globalThis);
