(() => {
    const selector = '[data-picker-tooltip]';
    let hoveredTarget = null;
    let focusedTarget = null;
    let tooltip = null;
    let visibleTarget = null;

    function getTooltip() {
        if (tooltip?.isConnected) return tooltip;

        tooltip = document.getElementById('abs-global-floating-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'abs-global-floating-tooltip';
            document.body.appendChild(tooltip);
        }

        tooltip.setAttribute('role', 'tooltip');
        tooltip.setAttribute('aria-hidden', 'true');
        return tooltip;
    }

    function hideTooltip() {
        if (!tooltip) return;
        tooltip.style.opacity = '0';
        tooltip.style.display = 'none';
        visibleTarget = null;
    }

    function positionTooltip(target, tip) {
        const targetRect = target.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const margin = 8;
        const gap = 7;
        let left = targetRect.left + (targetRect.width - tipRect.width) / 2;
        let top = targetRect.top - tipRect.height - gap;

        if (top < margin) top = targetRect.bottom + gap;
        left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));
        top = Math.max(margin, Math.min(top, window.innerHeight - tipRect.height - margin));

        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    }

    function refreshTooltip() {
        const target = focusedTarget || hoveredTarget;
        if (!target?.isConnected) {
            hideTooltip();
            return;
        }

        const text = target.getAttribute('data-picker-tooltip')?.trim();
        if (!text) {
            hideTooltip();
            return;
        }

        const tip = getTooltip();
        tip.classList.remove('info-link-tooltip');
        tip.textContent = text;
        tip.style.display = 'block';
        tip.style.opacity = '0';
        positionTooltip(target, tip);
        tip.style.opacity = '1';
        visibleTarget = target;
    }

    function closestTarget(eventTarget) {
        return eventTarget instanceof Element ? eventTarget.closest(selector) : null;
    }

    document.addEventListener('mouseover', event => {
        const target = closestTarget(event.target);
        if (!target || target === hoveredTarget) return;
        hoveredTarget = target;
        refreshTooltip();
    });

    document.addEventListener('mouseout', event => {
        const target = closestTarget(event.target);
        if (!target || target.contains(event.relatedTarget)) return;
        if (hoveredTarget === target) hoveredTarget = null;
        refreshTooltip();
    });

    document.addEventListener('focusin', event => {
        const target = closestTarget(event.target);
        if (!target) return;
        focusedTarget = target;
        refreshTooltip();
    });

    document.addEventListener('focusout', event => {
        const target = closestTarget(event.target);
        if (!target || target.contains(event.relatedTarget)) return;
        if (focusedTarget === target) focusedTarget = null;
        refreshTooltip();
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        hoveredTarget = null;
        focusedTarget = null;
        hideTooltip();
    });

    window.addEventListener('scroll', () => {
        if (!visibleTarget?.isConnected) return;
        positionTooltip(visibleTarget, getTooltip());
    }, true);

    window.addEventListener('resize', () => {
        if (!visibleTarget?.isConnected) return;
        positionTooltip(visibleTarget, getTooltip());
    });
})();
