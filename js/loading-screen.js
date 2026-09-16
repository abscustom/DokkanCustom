(() => {
    const screen = document.getElementById('abs-loading-screen');
    if (!screen) return;
    const loaderScriptUrl = document.currentScript?.src || window.location.href;

    let transitionToken = 0;
    let shownAt = performance.now();
    let hideTimer = 0;
    let safetyTimer = 0;
    let currentArtSource = '';
    let availableArtSources = [];
    let customArtSources = [];
    let officialArtSources = [];
    let cutinArtSources = [];
    let nextArtSource = '';
    let nextArtImage = null;
    let navigationArtPrepared = false;
    const transitionArtKey = 'abs_loading_transition_art';

    function isCutinSource(source) {
        return String(source || '').toLowerCase().includes('_cutin');
    }

    function isCharacterSource(source) {
        return String(source || '').toLowerCase().includes('_character');
    }

    function isOfficialCardSource(source) {
        return isCharacterSource(source) || isCutinSource(source);
    }

    /* ---------- Cosmic progress driver (1% -> 100% with saturation bloom) ---------- */
    let currentProgress = 1;
    let targetProgress = 1;
    let progressRaf = 0;
    let progressRunning = false;
    let completionStarted = false;
    let completionTimer = 0;
    let exitTimer = 0;

    function getPercentEl() {
        return screen.querySelector('#abs-loader-percent') || screen.querySelector('.abs-loader-percent');
    }

    function ensureBackdrop() {
        let bgArt = screen.querySelector('.abs-loader-art-backdrop');
        if (!bgArt) {
            bgArt = document.createElement('div');
            bgArt.className = 'abs-loader-art-backdrop';
            bgArt.setAttribute('aria-hidden', 'true');
            const bgArtContainer = screen.querySelector('.abs-loader-bg-art') || screen;
            bgArtContainer.prepend(bgArt);
        }
        return bgArt;
    }

    function renderProgress() {
        const clamped = Math.max(1, Math.min(100, currentProgress));
        const display = clamped >= 99.5 ? 100 : Math.floor(clamped);
        const percentEl = getPercentEl();
        if (percentEl && percentEl.textContent !== `${display}%`) {
            percentEl.textContent = `${display}%`;
        }

        // Dynamically reduce background blur as progress approaches 100% (5px -> 0px)
        const bgBlur = Math.max(0, (1 - (clamped / 100)) * 5);
        screen.style.setProperty('--abs-loader-bg-blur', `${bgBlur.toFixed(2)}px`);
        const artImgs = screen.querySelectorAll('.abs-loader-art img, .abs-loader-art-backdrop img');
        if (artImgs.length) {
            const p = clamped;
            const grayscale = Math.max(0, 100 - p);
            const saturate = Math.min(140, p * 1.15);
            const brightness = 0.92 + (p / 100) * 0.08;
            const imageBlur = Math.max(0, (1 - (p / 100)) * 6);
            const filterVal = `blur(${imageBlur.toFixed(2)}px) grayscale(${grayscale.toFixed(1)}%) saturate(${saturate.toFixed(1)}%) brightness(${brightness.toFixed(3)})`;
            artImgs.forEach(img => {
                img.style.filter = filterVal;
            });
        }
    }

    function stopProgressLoop() {
        progressRunning = false;
        if (progressRaf) cancelAnimationFrame(progressRaf);
        progressRaf = 0;
    }

    function progressTick() {
        if (!progressRunning) return;
        const diff = targetProgress - currentProgress;
        if (diff <= 0.05) {
            currentProgress = targetProgress;
        } else {
            // Smooth natural counting rate
            const rate = targetProgress >= 100 ? 0.14 : 0.10;
            const step = Math.max(0.35, diff * rate);
            currentProgress += step;
        }
        currentProgress = Math.max(1, Math.min(100, currentProgress));
        renderProgress();
        if (currentProgress >= 100) {
            currentProgress = 100;
            renderProgress();
            stopProgressLoop();
            beginCompletionSequence();
            return;
        }
        progressRaf = requestAnimationFrame(progressTick);
    }

    function startProgressLoop() {
        if (progressRunning) return;
        progressRunning = true;
        completionStarted = false;
        progressRaf = requestAnimationFrame(progressTick);
    }

    function setTargetProgress(value) {
        targetProgress = Math.max(targetProgress, Math.max(1, Math.min(100, Number(value) || 1)));
        startProgressLoop();
    }

    function resetProgress() {
        window.clearTimeout(completionTimer);
        window.clearTimeout(exitTimer);
        stopProgressLoop();
        completionStarted = false;
        screen.classList.remove('is-exiting', 'is-complete');
        screen.style.pointerEvents = '';
        currentProgress = 1;
        targetProgress = 1;
        renderProgress();
        startProgressLoop();
    }

    function beginCompletionSequence() {
        if (completionStarted) return;
        completionStarted = true;
        currentProgress = 100;
        renderProgress();
        screen.classList.add('is-complete');

        // Hold at 100% saturation: abs logo & percentage fade out smoothly, then trigger exit dissolve
        completionTimer = window.setTimeout(() => {
            screen.classList.remove('is-entering');
            screen.classList.add('is-exiting');
            screen.setAttribute('aria-hidden', 'true');
            screen.style.pointerEvents = 'none';

            // Clean up body overflow lock so the page underneath is interactive as it reveals
            document.documentElement.classList.remove('abs-page-loading');

            const finalizeExit = () => {
                screen.removeEventListener('animationend', finalizeExit);
                window.clearTimeout(exitTimer);
                screen.classList.add('is-hidden');
                screen.classList.remove('is-exiting', 'is-complete', 'is-entering');
                screen.style.pointerEvents = '';
                try {
                    window.dispatchEvent(new CustomEvent('abs-loading-complete'));
                } catch {}
            };

            screen.addEventListener('animationend', finalizeExit, { once: true });
            // Safety timeout matching the 0.85s animation (+100ms padding) in case animationend was suppressed
            exitTimer = window.setTimeout(finalizeExit, 950);
        }, 500);
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
        if (options.keepArt !== true) promoteNextArt();
        transitionToken += 1;
        const token = transitionToken;
        window.clearTimeout(hideTimer);
        window.clearTimeout(safetyTimer);
        window.clearTimeout(completionTimer);
        window.clearTimeout(exitTimer);
        shownAt = performance.now();
        screen.style.opacity = '';
        screen.style.transform = '';
        screen.style.transition = '';
        screen.style.pointerEvents = '';
        // Fade in from hidden: hold transparent for a frame, then release.
        screen.classList.remove('is-hidden', 'is-exiting', 'is-complete');
        screen.classList.add('is-entering');
        screen.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('abs-page-loading');
        void screen.offsetWidth;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => screen.classList.remove('is-entering'));
        });
        resetProgress();
        // Small initial nudge so the counter visibly leaves 1% on manual shows.
        setTargetProgress(12);

        safetyTimer = window.setTimeout(() => hide({ token }), Number(options.maxVisible || 8000));
        return token;
    }

    function hide(options = {}) {
        const token = options.token;
        if (!options.force && token !== undefined && token !== transitionToken) return;

        window.clearTimeout(hideTimer);
        window.clearTimeout(safetyTimer);
        if (options.force) {
            screen.classList.remove('is-entering');
            screen.classList.add('is-exiting');
            document.documentElement.classList.remove('abs-page-loading');
            const finalizeForce = () => {
                screen.removeEventListener('animationend', finalizeForce);
                screen.classList.add('is-hidden');
                screen.classList.remove('is-exiting', 'is-complete', 'is-entering');
            };
            screen.addEventListener('animationend', finalizeForce, { once: true });
            window.setTimeout(finalizeForce, 950);
            return;
        }

        const minimumVisible = Number(options.minimumVisible || 0);
        const elapsed = performance.now() - shownAt;
        const wait = Math.max(0, minimumVisible - elapsed);
        hideTimer = window.setTimeout(() => {
            if (token !== undefined && token !== transitionToken) return;
            setTargetProgress(100);
        }, wait);
    }

    function waitForImage(source) {
        return new Promise(resolve => {
            const image = new Image();
            image.alt = '';
            image.addEventListener('load', () => resolve(image), { once: true });
            image.addEventListener('error', () => resolve(null), { once: true });
            image.src = source;
        });
    }

    function takeCarriedTransitionArt() {
        try {
            const source = sessionStorage.getItem(transitionArtKey) || '';
            sessionStorage.removeItem(transitionArtKey);
            return source;
        } catch {
            return '';
        }
    }

    function carryCurrentTransitionArt() {
        const currentImage = screen.querySelector('.abs-loader-art img');
        const source = currentArtSource || currentImage?.src || '';
        if (!source || /^(?:blob:|data:)/i.test(source)) return;
        try {
            sessionStorage.setItem(transitionArtKey, source);
        } catch {}
    }

    async function setLoaderArt(source) {
        if (!source) return false;
        const image = await waitForImage(source);
        const art = screen.querySelector('.abs-loader-art');
        if (!image || !art) return false;
        currentArtSource = source;

        screen.classList.toggle('is-cutin', isCutinSource(source));
        screen.classList.toggle('is-character', isCharacterSource(source));

        const bgArt = ensureBackdrop();
        const bgImage = image.cloneNode(true);
        bgImage.alt = '';
        art.replaceChildren(image);
        if (bgArt) bgArt.replaceChildren(bgImage);

        renderProgress();
        return true;
    }

    function resolveArtSource(source) {
        if (!source) return '';
        return /^(?:data:|blob:|https?:)/i.test(source)
            ? source
            : new URL(`../${String(source).replace(/^\.\//, '')}`, loaderScriptUrl).href;
    }

    async function loadArtManifest() {
        if (availableArtSources.length) return availableArtSources;
        const manifestUrl = new URL('../json/loading-screen-images.json', loaderScriptUrl).href;
        const response = await fetch(manifestUrl, { cache: 'no-cache' });
        if (!response.ok) return [];

        const images = await response.json();
        if (!Array.isArray(images)) return [];
        availableArtSources = images.map(resolveArtSource).filter(Boolean);
        customArtSources = availableArtSources.filter(src => src.includes('/ui/loading-screen/'));
        officialArtSources = availableArtSources.filter(src => isOfficialCardSource(src));
        cutinArtSources = availableArtSources.filter(src => isCutinSource(src));
        return availableArtSources;
    }

    function chooseDifferentArtSource() {
        if (!availableArtSources.length) return '';

        // 50% chance for original custom loading screen images, 50% for official card character portraits
        const pickCustom = Math.random() < 0.5;
        let pool = pickCustom
            ? (customArtSources.length ? customArtSources : officialArtSources)
            : (officialArtSources.length ? officialArtSources : customArtSources);

        if (!pool || !pool.length) pool = availableArtSources;

        const differentSources = pool.filter(source => source !== currentArtSource);
        const choices = differentSources.length ? differentSources : pool;
        return choices[Math.floor(Math.random() * choices.length)] || '';
    }

    function prepareNextArt() {
        const source = chooseDifferentArtSource();
        if (!source) return;

        const image = new Image();
        image.alt = '';
        image.src = source;
        nextArtSource = source;
        nextArtImage = image;
    }

    function promoteNextArt() {
        if (!nextArtSource || !nextArtImage) return false;
        const art = screen.querySelector('.abs-loader-art');
        if (!art) return false;

        currentArtSource = nextArtSource;
        screen.classList.toggle('is-cutin', isCutinSource(currentArtSource));
        screen.classList.toggle('is-character', isCharacterSource(currentArtSource));

        const bgArt = ensureBackdrop();
        const bgImage = nextArtImage.cloneNode(true);
        bgImage.alt = '';
        art.replaceChildren(nextArtImage);
        if (bgArt) bgArt.replaceChildren(bgImage);

        renderProgress();
        nextArtSource = '';
        nextArtImage = null;
        prepareNextArt();
        return true;
    }

    async function showRandomImage() {
        try {
            // A page transition starts on the old page and finishes on the new
            // one. Reuse the old page's artwork so it remains one continuous
            // loading screen instead of flashing two different characters.
            const carriedSource = takeCarriedTransitionArt();
            const carriedArtWasSet = carriedSource
                ? await setLoaderArt(carriedSource)
                : false;

            await loadArtManifest();
            setTargetProgress(35);
            if (!carriedArtWasSet) {
                await setLoaderArt(chooseDifferentArtSource());
            }
            setTargetProgress(65);
            prepareNextArt();
        } catch {
            // An artwork-free cosmic backdrop is the safe fallback.
            setTargetProgress(40);
        }
    }

    function waitForContentImages(root, maxWait = 1400) {
        const contentRoot = typeof root === 'string' ? document.querySelector(root) : root;
        if (!contentRoot) return Promise.resolve();
        const pending = Array.from(contentRoot.querySelectorAll('img:not([loading="lazy"])'))
            .filter(image => !image.complete);
        if (!pending.length) return Promise.resolve();

        const loaded = Promise.all(pending.map(image => new Promise(resolve => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
        })));
        return Promise.race([loaded, delay(maxWait)]);
    }

    async function hideAfterContent(root = document.body, options = {}) {
        const token = options.token === undefined ? transitionToken : options.token;
        const maxWait = Number(options.maxWait || 1800);
        const fontsReady = document.fonts?.ready || Promise.resolve();
        await Promise.race([
            Promise.all([nextFrames(2), fontsReady, waitForContentImages(root, maxWait)]),
            delay(maxWait)
        ]);
        setTargetProgress(85);
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

    const pageLoaded = document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise(resolve => window.addEventListener('load', resolve, { once: true }));

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

    // Initial page-load sequence: no artificial data-loader-delay. The loader
    // advances on genuine milestones and fades as soon as the app is ready.
    const initialToken = transitionToken;
    shownAt = performance.now();
    // Preloader: the veil is already painted opaque by CSS alone, so the
    // site is never visible before it is ready. No JS fade-in needed.
    screen.classList.remove('is-hidden', 'is-entering', 'is-exiting', 'is-complete');
    screen.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('abs-page-loading');
    resetProgress();

    showRandomImage();
    Promise.all([pageLoaded, nextFrames(2), document.fonts?.ready || Promise.resolve()]).then(() => {
        setTargetProgress(85);
    });
    waitForContentImages(document.body, 1800).then(() => {
        if (targetProgress < 85) setTargetProgress(85);
    });
    appContentReady.then(() => {
        hideAfterContent(document.body, { token: initialToken, maxWait: 1500, minimumVisible: 650 });
    });
    // If a page never fires its ready event, still finish cleanly from real page load.
    pageLoaded.then(() => {
        window.setTimeout(() => {
            if (!completionStarted) {
                setTargetProgress(100);
            }
        }, 2200);
    });
    window.setTimeout(() => {
        if (!completionStarted) {
            setTargetProgress(100);
        }
    }, 5500);
    window.setTimeout(() => hide({ token: initialToken, force: true }), 9000);

    // Cover genuine document unloads immediately. Hash-only changes, same-
    // document anchors, downloads, and new-tab clicks never trigger the
    // full-screen takeover.
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
        if (!navigationArtPrepared) {
            promoteNextArt();
            navigationArtPrepared = true;
        }
        carryCurrentTransitionArt();
        show({ maxVisible: 5000, keepArt: true });
    });

    window.addEventListener('beforeunload', () => {
        if (!navigationArtPrepared) promoteNextArt();
        carryCurrentTransitionArt();
        show({ maxVisible: 5000, keepArt: true });
    });
    window.addEventListener('pageshow', event => {
        if (event.persisted) hide({ force: true });
    });

    window.absLoadingScreen = { show, hide, hideAfterContent, run };
})();
