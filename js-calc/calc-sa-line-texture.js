/* Passive, card-sized version of the calculator's simplex-wave background. */
(function initSaLineTextures() {
    const NS = 'http://www.w3.org/2000/svg';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const textures = new Map();
    let rafId = 0;

    function motionDisabled() {
        return reduceMotion.matches || document.body.classList.contains('fx-static');
    }

    function cardColor(card) {
        return getComputedStyle(card).getPropertyValue('--sa-hot').trim() || 'rgba(253, 224, 71, 0.55)';
    }

    function addTexture(card) {
        if (textures.has(card)) return;

        const svg = document.createElementNS(NS, 'svg');
        svg.classList.add('sa-card-lines');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        card.prepend(svg);

        const paths = [];
        for (let line = 0; line < 12; line++) {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', cardColor(card));
            path.setAttribute('stroke-width', line % 3 === 0 ? '1.15' : '0.75');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('opacity', line % 3 === 0 ? '0.48' : '0.28');
            svg.appendChild(path);
            paths.push(path);
        }
        textures.set(card, { svg, paths, phase: Math.random() * 100 });
    }

    function collect() {
        if (motionDisabled()) return;
        document.querySelectorAll('.sa-card-ultra, .sa-card-ex, .sa-card-unit, .sa-card-standard, .sa-card-active, .sa-card-sa-counter, .sa-card-norm-counter').forEach(addTexture);
    }

    function draw(now) {
        if (motionDisabled()) {
            rafId = 0;
            return;
        }

        collect();
        const time = now * 0.00055;
        textures.forEach((texture, card) => {
            if (!card.isConnected) {
                textures.delete(card);
                return;
            }
            const width = Math.max(1, card.clientWidth);
            const height = Math.max(1, card.clientHeight);
            texture.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            const gap = width / 11;

            texture.paths.forEach((path, index) => {
                let d = '';
                for (let point = 0; point <= 12; point++) {
                    const baseX = point * gap - gap;
                    const phase = time + texture.phase + index * 0.38 + point * 0.31;
                    const x = baseX + Math.sin(phase * 1.17) * 4.2 + Math.sin(phase * 0.47) * 2.1;
                    const y = index * (height / 11) + Math.cos(phase * 0.93) * 4.8;
                    d += `${point === 0 ? 'M' : ' L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                }
                path.setAttribute('d', d);
            });
        });
        if (!motionDisabled()) rafId = requestAnimationFrame(draw);
    }

    function syncAnimationState() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (!motionDisabled()) rafId = requestAnimationFrame(draw);
    }

    const observer = new MutationObserver(collect);
    observer.observe(document.body, { childList: true, subtree: true });
    collect();
    syncAnimationState();
    reduceMotion.addEventListener('change', syncAnimationState);
    window.addEventListener('abs-fx-mode-change', syncAnimationState);
})();
