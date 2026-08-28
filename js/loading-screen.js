(() => {
    const screen = document.getElementById('abs-loading-screen');
    let completed = false;

    function hide() {
        if (completed || !screen) return;
        completed = true;
        screen.classList.add('is-hidden');
        window.setTimeout(() => screen.remove(), 400);
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

    async function showRandomImage() {
        if (!screen) return;

        try {
            const response = await fetch('json/loading-screen-images.json', { cache: 'no-cache' });
            if (!response.ok) return;

            const images = await response.json();
            if (!Array.isArray(images) || images.length === 0) return;

            const image = await waitForImage(images[Math.floor(Math.random() * images.length)]);
            if (image) screen.querySelector('.abs-loader-art').append(image);
        } catch {
            // A black, image-free screen is the safe fallback if the manifest is unavailable.
        }
    }

    const pageLoaded = document.readyState === 'complete'
        ? Promise.resolve()
        : new Promise(resolve => window.addEventListener('load', resolve, { once: true }));

    const appContentReady = screen?.dataset.loaderWaitForApp !== 'true'
        ? Promise.resolve()
        : new Promise(resolve => {
            if (window.absHomeContentReady) {
                resolve();
                return;
            }
            window.addEventListener('abs-home-content-ready', resolve, { once: true });
        });

    const extraDelay = Number.parseInt(screen?.dataset.loaderDelay || '150', 10);
    Promise.all([pageLoaded, showRandomImage(), appContentReady]).then(() => window.setTimeout(hide, extraDelay));
    window.setTimeout(hide, 10000);
    window.absLoadingScreen = { hide };
})();
