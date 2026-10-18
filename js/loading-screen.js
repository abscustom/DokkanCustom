(() => {
    const screen = document.getElementById('abs-loading-screen');
    if (!screen || window.absLoadingScreen) return;

    let transitionToken = 0;
    let shownAt = performance.now();
    let hideTimer = 0;
    let safetyTimer = 0;
    let navigationToken = null;
    let completionStarted = false;
    let exitTimer = 0;
    let exitListener = null;

    // Older published HTML can still contain a counter. Upgrade its markup
    // once without starting a decorative progress driver or another overlay.
    screen.querySelectorAll('.abs-loader-percent, .abs-loader-sub').forEach(element => element.remove());
    if (!screen.querySelector('.abs-loader-status')) {
        const status = document.createElement('div');
        status.className = 'abs-loader-status';
        status.textContent = 'Loading…';
        (screen.querySelector('.abs-loader-stage') || screen).appendChild(status);
    }

    function cancelExit() {
        window.clearTimeout(exitTimer);
        if (exitListener) screen.removeEventListener('animationend', exitListener);
        exitListener = null;
        completionStarted = false;
        screen.classList.remove('is-exiting', 'is-complete');
        screen.style.pointerEvents = '';
    }

    function beginCompletionSequence() {
        if (completionStarted || screen.dataset.loaderError === 'true') return;
        const token = transitionToken;
        completionStarted = true;
        // One fade owns the entire overlay; no child blur/scale can outlive it.
        screen.classList.remove('is-entering');
        screen.classList.remove('is-navigating');
        screen.classList.add('is-exiting');
        screen.setAttribute('aria-hidden', 'true');
        screen.setAttribute('aria-busy', 'false');
        screen.style.pointerEvents = 'none';

        // Release scrolling as the ready page reveals.
        document.documentElement.classList.remove('abs-page-loading');

        const finalizeExit = event => {
            if (event && (event.target !== screen || event.animationName !== 'abs-loader-exit-dissolve')) return;
            if (token !== transitionToken) return;
            screen.removeEventListener('animationend', finalizeExit);
            exitListener = null;
            window.clearTimeout(exitTimer);
            screen.classList.add('is-hidden');
            screen.classList.remove('is-exiting', 'is-complete', 'is-entering');
            navigationToken = null;
            screen.style.pointerEvents = '';
            try {
                window.dispatchEvent(new CustomEvent('abs-loading-complete'));
            } catch {}
        };

        exitListener = finalizeExit;
        screen.addEventListener('animationend', finalizeExit);
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finalizeExit();
        else exitTimer = window.setTimeout(finalizeExit, 280);
    }

    function nextFrames(count = 2) {
        return new Promise(resolve => {
            const step = () => {
                count -= 1;
                if (count <= 0) resolve();
                else requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        });
    }

    function delay(ms) {
        return new Promise(resolve => window.setTimeout(resolve, Math.max(0, ms || 0)));
    }

    function show(options = {}) {
        transitionToken += 1;
        const token = transitionToken;
        window.clearTimeout(hideTimer);
        window.clearTimeout(safetyTimer);
        window.clearTimeout(exitTimer);
        shownAt = performance.now();
        screen.style.opacity = '';
        screen.style.transform = '';
        screen.style.transition = '';
        screen.style.pointerEvents = '';
        // Fade in from hidden: hold transparent for a frame, then release.
        screen.classList.remove('is-hidden', 'is-exiting', 'is-complete');
        if (!options.immediate) screen.classList.add('is-entering');
        else screen.classList.remove('is-entering');
        screen.classList.toggle('is-navigating', !!options.navigation);
        screen.setAttribute('aria-hidden', 'false');
        screen.setAttribute('aria-busy', 'true');
        document.documentElement.classList.add('abs-page-loading');
        cancelExit();
        if (!options.immediate) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (token === transitionToken) screen.classList.remove('is-entering');
                });
            });
        }

        safetyTimer = window.setTimeout(() => {
            if (options.navigation) hide({ token });
            else showStartupError(token);
        }, Number(options.maxVisible || 8000));
        return token;
    }

    function hide(options = {}) {
        const token = options.token;
        if (!options.force && token !== undefined && token !== transitionToken) return;

        window.clearTimeout(hideTimer);
        window.clearTimeout(safetyTimer);
        if (options.force) {
            cancelExit();
            completionStarted = true;
            screen.classList.add('is-hidden');
            screen.classList.remove('is-entering', 'is-exiting', 'is-complete', 'is-navigating');
            navigationToken = null;
            screen.setAttribute('aria-hidden', 'true');
            screen.setAttribute('aria-busy', 'false');
            document.documentElement.classList.remove('abs-page-loading');
            return;
        }

        const minimumVisible = Number(options.minimumVisible || 0);
        const elapsed = performance.now() - shownAt;
        const wait = Math.max(0, minimumVisible - elapsed);
        hideTimer = window.setTimeout(() => {
            if (token !== undefined && token !== transitionToken) return;
            beginCompletionSequence();
        }, wait);
    }

    const essentialImageSelector = '#abs-art-img, [data-card-element="abs-art-img"], #myOverlayImage, #calc-char-thumb, .char-img, .thumb-img, .form-image, .hub-circle-img, .tl-char-img, .sba-showcase-art-poster, [data-loader-essential]';

    function getEssentialImages(root) {
        return Array.from(root.querySelectorAll('img')).filter(image => image.matches?.(essentialImageSelector) && isCriticalVisibleContent(image));
    }

    function waitForContentImages(root) {
        const contentRoot = typeof root === 'string' ? document.querySelector(root) : root;
        if (!contentRoot) return Promise.resolve(true);
        const images = getEssentialImages(contentRoot);
        return Promise.all(images.map(image => {
            const ready = () => image.naturalWidth > 0;
            return new Promise(resolve => {
                let settled = false;
                const finish = result => {
                    if (settled) return;
                    settled = true;
                    window.clearTimeout(timer);
                    image.removeEventListener('load', done);
                    image.removeEventListener('error', done);
                    resolve(result);
                };
                const done = event => {
                    // Page-owned error handlers may have started a fallback
                    // image request before this listener receives the error.
                    if (!image.complete) return;
                    // The official layout initially clones an empty portrait
                    // slot, then assigns its circle-art source on the next
                    // render. An empty, complete slot is not a failed request.
                    if (!image.naturalWidth && !image.getAttribute?.('src') && !event) return;
                    if (image.naturalWidth > 0 && image.decode) {
                        const source = image.currentSrc || image.src;
                        image.decode().then(() => {
                            if (source === (image.currentSrc || image.src)) finish(true);
                        }).catch(() => {
                            if (source === (image.currentSrc || image.src)) finish(false);
                        });
                    } else finish(ready());
                };
                const timer = window.setTimeout(() => finish(false), 8000);
                image.addEventListener('load', done);
                image.addEventListener('error', done);
                if (image.complete) done();
            });
        })).then(results => results.every(Boolean));
    }

    function isCriticalVisibleContent(element) {
        if (element.closest('#abs-loading-screen, [aria-hidden="true"], [data-loader-decorative], .dokkan-news-snippet')) return false;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        let rect = element.getBoundingClientRect();
        // Unloaded content images may not yet have an intrinsic height. Their
        // reserved card/frame box still identifies visible, essential art.
        if ((!rect.width || !rect.height) && element.tagName === 'IMG' && element.parentElement) {
            rect = element.parentElement.getBoundingClientRect();
        }
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    }

    function waitForContentFonts(root) {
        if (!document.fonts?.load || document.fonts.status !== 'loading') return Promise.resolve();
        const samples = [root, ...root.querySelectorAll('h1, h2, button, input')].filter(isCriticalVisibleContent).slice(0, 5);
        const fonts = new Set(samples.map(element => getComputedStyle(element).font).filter(Boolean));
        return Promise.all(Array.from(fonts, font => document.fonts.load(font).catch(() => {})));
    }

    async function hideAfterContent(root = document.body, options = {}) {
        const token = options.token === undefined ? transitionToken : options.token;
        const maxWait = Number(options.maxWait || 1800);
        const contentRoot = (typeof root === 'string' ? document.querySelector(root) : root) || document.body;
        await nextFrames(2);
        if (token !== transitionToken || screen.dataset.loaderError === 'true') return;
        const [, imagesReady] = await Promise.all([
            Promise.race([waitForContentFonts(contentRoot), delay(maxWait)]),
            waitForContentImages(contentRoot)
        ]);
        if (token !== transitionToken || screen.dataset.loaderError === 'true') return;
        if (!imagesReady) {
            showStartupError(token);
            return;
        }
        hide({
            token,
            minimumVisible: Number(options.minimumVisible || 0)
        });
    }

    async function run(task, options = {}) {
        const token = show(options);
        try {
            return await (typeof task === 'function' ? task() : task);
        } finally {
            hideAfterContent(options.root || document.body, { ...options, token });
        }
    }

    const documentReady = document.readyState !== 'loading'
        ? Promise.resolve()
        : new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));

    const readyEventName = screen.dataset.loaderReadyEvent ||
        (screen.dataset.loaderWaitForApp === 'true' ? 'abs-home-content-ready' : '');
    const readyFlagName = screen.dataset.loaderReadyFlag ||
        (readyEventName === 'abs-home-content-ready' ? 'absHomeContentReady' : '');
    const appContentReady = !readyEventName
        ? Promise.resolve()
        : new Promise(resolve => {
            if (readyFlagName && window[readyFlagName]) {
                resolve();
                return;
            }
            window.addEventListener(readyEventName, resolve, { once: true });
        });

    // Shared shell readiness never substitutes for page-owned readiness.
    const shellReadyEventName = screen.dataset.loaderShellReadyEvent || '';
    const shellReadyFlagName = screen.dataset.loaderShellReadyFlag || '';
    const shellContentReady = !shellReadyEventName
        ? Promise.resolve()
        : new Promise(resolve => {
            if (shellReadyFlagName && window[shellReadyFlagName]) {
                resolve();
                return;
            }
            window.addEventListener(shellReadyEventName, resolve, { once: true });
        });

    // Initial reveal follows application readiness and the visible content gate.
    const initialToken = transitionToken;
    shownAt = performance.now();
    // Preloader: the veil is already painted opaque by CSS alone, so the
    // site is never visible before it is ready. No JS fade-in needed.
    screen.classList.remove('is-hidden', 'is-entering', 'is-exiting', 'is-complete');
    screen.setAttribute('aria-hidden', 'false');
    screen.setAttribute('aria-busy', 'true');
    document.documentElement.classList.add('abs-page-loading');
    cancelExit();

    Promise.all([documentReady, appContentReady, shellContentReady]).then(() => {
        if (initialToken !== transitionToken) return;
        window.clearTimeout(safetyTimer);
        hideAfterContent(document.body, { token: initialToken, maxWait: 1500 });
    });
    // A missing essential ready signal must recover with an actionable error,
    // rather than uncovering an empty card or unfinished imported calculator.
    function showStartupError(token = initialToken) {
        if (token !== transitionToken || completionStarted) return;
        screen.setAttribute('aria-busy', 'false');
        screen.setAttribute('role', 'alert');
        if (screen.dataset.loaderError === 'true') return;
        screen.dataset.loaderError = 'true';
        const message = document.createElement('p');
        message.textContent = 'This page could not finish loading. Check your connection and retry.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', () => window.location.reload());
        const stage = screen.querySelector('.abs-loader-stage') || screen;
        stage.replaceChildren(message, retry);
        stage.style.pointerEvents = 'auto';
        document.documentElement.classList.remove('abs-page-loading');
    }
    safetyTimer = window.setTimeout(showStartupError, 15000);
    window.addEventListener('abs-card-bootstrap-error', () => showStartupError());
    window.addEventListener('abs-calculator-bootstrap-error', () => showStartupError());

    // Cover genuine document unloads immediately. Hash-only changes, same-
    // document anchors, downloads, and new-tab clicks never trigger the
    // full-screen takeover.
    function beginNavigation() {
        if (navigationToken !== null) return navigationToken;
        navigationToken = show({ maxVisible: 5000, immediate: true, navigation: true });
        return navigationToken;
    }
    document.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
        const href = anchor.getAttribute('href') || '';
        if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return;

        let destination;
        try {
            destination = new URL(anchor.href, window.location.href);
        } catch {
            return;
        }
        if (destination.origin !== window.location.origin) return;
        if (destination.href === window.location.href) return;
        // Same document, different hash: in-page navigation, not a page load.
        if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
        beginNavigation();
    });

    window.addEventListener('beforeunload', () => {
        beginNavigation();
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted && screen.dataset.loaderError !== 'true') hide({ force: true });
    });

    window.absLoadingScreen = { show, hide, hideAfterContent, run };
})();
