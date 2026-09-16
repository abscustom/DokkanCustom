(() => {
    const KEY = 'hub_selected_style';

    // ── Universal smooth horizontal auto-scroll engine (standalone from main.js) ──
    window.attachSmoothHorizontalScroll = function(el, autoScrollSpeed = 0.28) {
        if (!el) return;
        el.dataset.autoScrollSpeed = String(autoScrollSpeed);

        if (el._hAutoScrollId) {
            cancelAnimationFrame(el._hAutoScrollId);
            el._hAutoScrollId = null;
        }

        if (!el.dataset.hScrollAttached) {
            el.dataset.hScrollAttached = "true";
            let isDown = false;
            let startX = 0;
            let scrollStart = 0;
            let hasMoved = false;
            let isUserInteracting = false;
            let resumeTimer = null;

            const pauseTemporarily = (duration = 2000) => {
                isUserInteracting = true;
                clearTimeout(resumeTimer);
                resumeTimer = setTimeout(() => {
                    isUserInteracting = false;
                }, duration);
            };

            el.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    el.scrollLeft += e.deltaY;
                    pauseTemporarily(2000);
                }
            }, { passive: false });

            el.addEventListener('mousemove', (e) => {
                if (isDown) {
                    const x = e.pageX - el.offsetLeft;
                    const walk = (x - startX) * 1.5;
                    if (Math.abs(walk) > 4) hasMoved = true;
                    el.scrollLeft = scrollStart - walk;
                }
                pauseTemporarily(2500);
            });

            el.addEventListener('mouseleave', () => {
                if (!isDown) {
                    isUserInteracting = false;
                    clearTimeout(resumeTimer);
                }
            });

            el.addEventListener('touchstart', () => pauseTemporarily(3000), { passive: true });
            el.addEventListener('touchmove', () => pauseTemporarily(3000), { passive: true });
            el.addEventListener('touchend', () => pauseTemporarily(1500), { passive: true });

            el.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                isDown = true;
                isUserInteracting = true;
                hasMoved = false;
                startX = e.pageX - el.offsetLeft;
                scrollStart = el.scrollLeft;
            });

            window.addEventListener('mouseup', () => {
                if (isDown) {
                    isDown = false;
                    pauseTemporarily(1200);
                }
            });

            window.addEventListener('blur', () => {
                isDown = false;
                isUserInteracting = false;
            });

            el.addEventListener('click', (e) => {
                if (hasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                    hasMoved = false;
                }
            }, true);

            el._checkInteracting = () => isUserInteracting;
        }

        let subPixelAcc = 0;
        function autoScrollTick() {
            if (document.body.classList.contains('fx-static')) {
                el._hAutoScrollId = null;
                return;
            }

            const isPaused = el._checkInteracting ? el._checkInteracting() : false;
            const maxScroll = el.scrollWidth - el.clientWidth;

            if (!isPaused && maxScroll > 5) {
                subPixelAcc += autoScrollSpeed;
                if (subPixelAcc >= 1) {
                    const px = Math.floor(subPixelAcc);
                    subPixelAcc -= px;
                    el.scrollLeft += px;

                    let singleSetWidth = parseFloat(el.dataset.singleSetWidth);
                    if (!singleSetWidth) {
                        const firstChild = el.firstElementChild;
                        const setLen = parseInt(el.dataset.setLength, 10);
                        if (firstChild && setLen && el.children[setLen]) {
                            const r0 = firstChild.getBoundingClientRect();
                            const rN = el.children[setLen].getBoundingClientRect();
                            singleSetWidth = Math.round(rN.left - r0.left);
                            if (singleSetWidth > 50) el.dataset.singleSetWidth = String(singleSetWidth);
                        }
                    }

                    if (singleSetWidth > 0 && el.scrollLeft >= singleSetWidth) {
                        el.scrollLeft -= singleSetWidth;
                    } else if (el.scrollLeft >= maxScroll - 2) {
                        el.scrollLeft = 0;
                    }
                }
            }
            el._hAutoScrollId = requestAnimationFrame(autoScrollTick);
        }

        if (!document.body.classList.contains('fx-static')) {
            el._hAutoScrollId = requestAnimationFrame(autoScrollTick);
        }
    };

    const icons = {
        home: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 21V13.6C9 13.0399 9 12.7599 9.10899 12.546C9.20487 12.3578 9.35785 12.2049 9.54601 12.109C9.75992 12 10.0399 12 10.6 12H13.4C13.9601 12 14.2401 12 14.454 12.109C14.6422 12.2049 14.7951 12.3578 14.891 12.546C15 12.7599 15 13.0399 15 13.6V21M11.0177 2.764L4.23539 8.03912C3.78202 8.39175 3.55534 8.56806 3.39203 8.78886C3.24737 8.98444 3.1396 9.20478 3.07403 9.43905C3 9.70352 3 9.9907 3 10.5651V17.8C3 18.9201 3 19.4801 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4801 21 18.9201 21 17.8V10.5651C21 9.9907 21 9.70352 20.926 9.43905C20.8604 9.20478 20.7526 8.98444 20.608 8.78886C20.4447 8.56806 20.218 8.39175 19.7646 8.03913L12.9823 2.764C12.631 2.49075 12.4553 2.35412 12.2613 2.3016C12.0902 2.25526 11.9098 2.25526 11.7387 2.3016C11.5447 2.35412 11.369 2.49075 11.0177 2.764Z"/></svg>',
        cards: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.00002 21.8174C4.6026 22 5.41649 22 6.8 22H17.2C18.5835 22 19.3974 22 20 21.8174M4.00002 21.8174C3.87082 21.7783 3.75133 21.7308 3.63803 21.673C3.07354 21.3854 2.6146 20.9265 2.32698 20.362C2 19.7202 2 18.8802 2 17.2V6.8C2 5.11984 2 4.27976 2.32698 3.63803C2.6146 3.07354 3.07354 2.6146 3.63803 2.32698C4.27976 2 5.11984 2 6.8 2H17.2C18.8802 2 19.7202 2 20.362 2.32698C20.9265 2.6146 21.3854 3.07354 21.673 3.63803C22 4.27976 22 5.11984 22 6.8V17.2C22 18.8802 22 19.7202 21.673 20.362C21.3854 20.9265 20.9265 21.3854 20.362 21.673C20.2487 21.7308 20.1292 21.7783 20 21.8174M4.00002 21.8174C4.00035 21.0081 4.00521 20.5799 4.07686 20.2196C4.39249 18.6329 5.63288 17.3925 7.21964 17.0769C7.60603 17 8.07069 17 9 17H15C15.9293 17 16.394 17 16.7804 17.0769C18.3671 17.3925 19.6075 18.6329 19.9231 20.2196C19.9948 20.5799 19.9996 21.0081 20 21.8174M16 9.5C16 11.7091 14.2091 13.5 12 13.5C9.79086 13.5 8 11.7091 8 9.5C8 7.29086 9.79086 5.5 12 5.5C14.2091 5.5 16 7.29086 16 9.5Z"/></svg>',
        calculator: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17.5 6.5L6.5 17.5M8.5 10.5V6.5M6.5 8.5H10.5M13.5 15.5H17.5M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z"/></svg>',
        editor: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 15.5H7.5C6.10444 15.5 5.40665 15.5 4.83886 15.6722C3.56045 16.06 2.56004 17.0605 2.17224 18.3389C2 18.9067 2 19.6044 2 21M14.5 7.5C14.5 9.98528 12.4853 12 10 12C7.51472 12 5.5 9.98528 5.5 7.5C5.5 5.01472 7.51472 3 10 3C12.4853 3 14.5 5.01472 14.5 7.5ZM11 21L14.1014 20.1139C14.2499 20.0715 14.3241 20.0502 14.3934 20.0184C14.4549 19.9902 14.5134 19.9558 14.5679 19.9158C14.6293 19.8707 14.6839 19.8161 14.7932 19.7068L21.25 13.25C21.9404 12.5597 21.9404 11.4403 21.25 10.75C20.5597 10.0596 19.4404 10.0596 18.75 10.75L12.2932 17.2068C12.1839 17.3161 12.1293 17.3707 12.0842 17.4321C12.0442 17.4866 12.0098 17.5451 11.9816 17.6066C11.9497 17.6759 11.9285 17.7501 11.8861 17.8987L11 21Z"/></svg>',
        news: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21L11.8999 20.8499C11.2053 19.808 10.858 19.287 10.3991 18.9098C9.99286 18.5759 9.52476 18.3254 9.02161 18.1726C8.45325 18 7.82711 18 6.57482 18H5.2C4.07989 18 3.51984 18 3.09202 17.782C2.71569 17.5903 2.40973 17.2843 2.21799 16.908C2 16.4802 2 15.9201 2 14.8V6.2C2 5.07989 2 4.51984 2.21799 4.09202C2.40973 3.71569 2.71569 3.40973 3.09202 3.21799C3.51984 3 4.07989 3 5.2 3H5.6C7.84021 3 8.96031 3 9.81596 3.43597C10.5686 3.81947 11.1805 4.43139 11.564 5.18404C12 6.03968 12 7.15979 12 9.4M12 21V9.4M12 21L12.1001 20.8499C12.7947 19.808 13.142 19.287 13.6009 18.9098C14.0071 18.5759 14.4752 18.3254 14.9784 18.1726C15.5467 18 16.1729 18 17.4252 18H18.8C19.9201 18 20.4802 18 20.908 17.782C21.2843 17.5903 21.5903 17.2843 21.782 16.908C22 16.4802 22 15.9201 22 14.8V6.2C22 5.07989 22 4.51984 21.782 4.09202C21.5903 3.71569 21.2843 3.40973 20.908 3.21799C20.4802 3 19.9201 3 18.8 3H18.4C16.1598 3 15.0397 3 14.184 3.43597C13.4314 3.81947 12.8195 4.43139 12.436 5.18404C12 6.03968 12 7.15979 12 9.4"/></svg>',
        settings: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5v.2h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1A1.7 1.7 0 0 0 5 15a1.7 1.7 0 0 0-1.5-1H3.3v-4h.2A1.7 1.7 0 0 0 5 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v4h-.2a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
        export: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>',
        save: '<svg class="sba-tool-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12l3 3v15H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>'
    };

    const addIcons = () => {
        document.querySelectorAll('[data-tool-icon]').forEach((target) => {
            if (!target.querySelector('svg') && icons[target.dataset.toolIcon]) target.insertAdjacentHTML('afterbegin', icons[target.dataset.toolIcon]);
        });
        document.querySelectorAll('[data-sba-source]').forEach((target) => {
            const source = document.querySelector(target.dataset.sbaSource);
            const svg = source?.querySelector('svg');
            if (!target.querySelector('svg') && svg) {
                const copy = svg.cloneNode(true);
                copy.classList.add('sba-tool-nav-icon');
                copy.removeAttribute('style');
                target.prepend(copy);
            }
        });
    };
    const applyCalculatorTheme = (style) => {
        const norm = style === 'dokkaninfo' ? 'dokkaninfo' : (style === 'sba' ? 'sba' : 'abs-style');
        document.body.classList.remove('theme-abs-style', 'theme-sba', 'theme-abs-clean', 'theme-dokkaninfo', 'theme-placeholder');
        if (norm === 'sba') {
            document.body.classList.add('theme-sba', 'theme-abs-clean');
        } else if (norm === 'dokkaninfo') {
            document.body.classList.add('theme-dokkaninfo');
        } else {
            document.body.classList.add('theme-abs-style');
        }
    };

    const setStyle = (style) => {
        localStorage.setItem(KEY, style);
        if (document.body.classList.contains('editor-tool-page') && window.switchCardTheme) {
            window.switchCardTheme(style === 'dokkaninfo' ? 'dokkaninfo' : (style === 'sba' ? 'sba' : 'abs-style'));
        } else {
            applyCalculatorTheme(style);
        }
        document.querySelectorAll('[data-tool-theme]').forEach((button) => button.classList.toggle('active', button.dataset.toolTheme === style));
    };

    // ── Bottom-dock reveal (matches main.js behaviour exactly) ──────────────
    let sbaNavHideTimer = null;

    const isBottomDockActive = () => {
        return document.body.classList.contains('theme-sba') ||
               document.body.classList.contains('theme-abs-clean') ||
               document.body.classList.contains('editor-tool-page') ||
               document.body.classList.contains('calc-liquid-body');
    };

    const isEditorSidebarActive = () => {
        const editor = document.getElementById('editor');
        const toggleBtn = document.getElementById('toggleBtn');
        return document.body.classList.contains('editor-sidebar-open') ||
               Boolean(editor?.classList.contains('open')) ||
               Boolean(editor?.classList.contains('is-open')) ||
               Boolean(toggleBtn?.classList.contains('active')) ||
               document.body.classList.contains('sba-side-settings-open');
    };

    const isPublishedEditorLocked = () => {
        const body = document.body;
        return Boolean(body?.classList.contains('editor-tool-page') &&
            body.classList.contains('is-published') &&
            !body.classList.contains('admin-mode-active'));
    };

    function revealToolSbaNav() {
        if (!isBottomDockActive()) return;
        if (isPublishedEditorLocked()) return;
        if (sbaNavHideTimer) { clearTimeout(sbaNavHideTimer); sbaNavHideTimer = null; }
        document.body.classList.add('sba-bottom-nav-visible');
    }

    function scheduleToolSbaNavHide(delay = 800) {
        if (!isBottomDockActive()) return;
        if (isPublishedEditorLocked()) {
            document.body.classList.remove('sba-bottom-nav-visible');
            return;
        }
        // Keep dock visible permanently while editor sidebar or settings drawer is active
        if (isEditorSidebarActive()) return;
        if (sbaNavHideTimer) clearTimeout(sbaNavHideTimer);
        sbaNavHideTimer = setTimeout(() => {
            if (isEditorSidebarActive()) return;
            document.body.classList.remove('sba-bottom-nav-visible');
            sbaNavHideTimer = null;
        }, delay);
    }

    // Expose helpers globally
    window.revealToolSbaNav = revealToolSbaNav;
    window.scheduleToolSbaNavHide = scheduleToolSbaNavHide;
    window.isEditorSidebarActive = isEditorSidebarActive;

    document.addEventListener('pointermove', (event) => {
        if (!isBottomDockActive()) return;
        if (isPublishedEditorLocked()) return;
        const nav = document.querySelector('.hud-nav-group');
        const drawer = document.getElementById('settingsDrawer');
        const editor = document.getElementById('editor');
        const isInsideNav = Boolean(nav?.contains(event.target));
        const isInsideDrawer = Boolean(drawer?.contains(event.target));
        const isInsideEditor = Boolean(editor?.contains(event.target));
        const isNearBottom = event.clientY >= window.innerHeight - 112;
        if (isNearBottom || isInsideNav || isInsideDrawer || isInsideEditor || isEditorSidebarActive()) {
            revealToolSbaNav();
        } else {
            scheduleToolSbaNavHide();
        }
    }, { passive: true });

    window.addEventListener('resize', () => {
        if (isBottomDockActive() && !isEditorSidebarActive()) {
            document.body.classList.remove('sba-bottom-nav-visible');
        }
    }, { passive: true });

    // ── Shared liquid-glass lens (matches Home's main.js initialisation) ─────
    function initializeToolSbaLiquidGlass() {
        const displacementImage = document.getElementById('sba-liquid-displacement-map');
        if (displacementImage) {
            const size = 128;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d', { willReadFrequently: false });
            const pixels = context?.createImageData(size, size);

            if (context && pixels) {
                for (let y = 0; y < size; y += 1) {
                    for (let x = 0; x < size; x += 1) {
                        const nx = ((x + 0.5) / size - 0.5) * 2;
                        const ny = ((y + 0.5) / size - 0.5) * 2;
                        const radius = Math.min(1, Math.hypot(nx, ny));
                        const edge = Math.max(0, Math.min(1, (radius - 0.38) / 0.62));
                        const easedEdge = edge * edge * (3 - (2 * edge));
                        const inverseRadius = radius > 0.0001 ? 1 / radius : 0;
                        const offset = (y * size + x) * 4;
                        pixels.data[offset] = Math.round(128 - (nx * inverseRadius * easedEdge * 112));
                        pixels.data[offset + 1] = Math.round(128 - (ny * inverseRadius * easedEdge * 112));
                        pixels.data[offset + 2] = 128;
                        pixels.data[offset + 3] = 255;
                    }
                }
                context.putImageData(pixels, 0, 0);
                displacementImage.setAttribute('href', canvas.toDataURL('image/png'));
            }
        }

        document.querySelectorAll('.hud-nav-link').forEach((control) => {
            if (control.dataset.glassHighlightAttached) return;
            control.dataset.glassHighlightAttached = 'true';
            control.addEventListener('pointermove', (event) => {
                if (!isBottomDockActive()) return;
                const bounds = control.getBoundingClientRect();
                const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                control.style.setProperty('--sba-glass-x', `${Math.max(0, Math.min(100, x))}%`);
                control.style.setProperty('--sba-glass-y', `${Math.max(0, Math.min(100, y))}%`);
            });
            control.addEventListener('pointerleave', () => {
                control.style.removeProperty('--sba-glass-x');
                control.style.removeProperty('--sba-glass-y');
            });
        });

        document.querySelectorAll('.hud-nav-group').forEach((dock) => {
            if (dock.dataset.highlightAttached) return;
            dock.dataset.highlightAttached = 'true';
            dock.addEventListener('pointermove', (event) => {
                if (!isBottomDockActive()) return;
                const bounds = dock.getBoundingClientRect();
                const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                dock.style.setProperty('--sba-dock-x', `${Math.max(0, Math.min(100, x))}%`);
                dock.style.setProperty('--sba-dock-y', `${Math.max(0, Math.min(100, y))}%`);
            });
            dock.addEventListener('pointerleave', () => {
                dock.style.removeProperty('--sba-dock-x');
                dock.style.removeProperty('--sba-dock-y');
            });
        });
    }

    window.addEventListener('DOMContentLoaded', () => {
        const rawStyle = localStorage.getItem(KEY);
        const style = rawStyle ? rawStyle : 'sba';
        if (document.body.classList.contains('editor-tool-page') && window.switchCardTheme) {
            if (style === 'sba') window.switchCardTheme('sba');
        } else {
            applyCalculatorTheme(style);
        }
        addIcons();
        document.querySelectorAll('[data-tool-theme]').forEach((button) => {
            button.classList.toggle('active', button.dataset.toolTheme === style);
            button.addEventListener('click', () => setStyle(button.dataset.toolTheme));
        });
        initializeToolSbaLiquidGlass();
        initializeEditorTopBar();

        // ── Auto-attach news ticker horizontal scrolling if present ──────
        const initToolNewsTicker = () => {
            document.querySelectorAll('.sba-news-ticker-track').forEach((track) => {
                if (!track.dataset.hScrollAttached && window.attachSmoothHorizontalScroll) {
                    window.attachSmoothHorizontalScroll(track, 0.30);
                }
            });
        };
        setTimeout(initToolNewsTicker, 300);
        setTimeout(initToolNewsTicker, 1000);
    });

    // ── Universal Settings Drawer & Popover Engine ────────────────────────
    window.positionSettingsMiniGui = function() {
        const drawer = document.getElementById('settingsDrawer');
        const btn = document.getElementById('sba-side-settings-button') || document.querySelector('.hud-nav-link[aria-label="Settings"]');
        if (!drawer || !btn) return;
        const btnRect = btn.getBoundingClientRect();
        const drawerWidth = Math.min(480, window.innerWidth - 24);
        
        let left = btnRect.left + (btnRect.width / 2) - (drawerWidth / 2);
        left = Math.max(12, Math.min(window.innerWidth - drawerWidth - 12, left));
        
        const isTopNav = btnRect.top < window.innerHeight / 2;
        drawer.style.setProperty('position', 'fixed', 'important');
        drawer.style.setProperty('left', `${Math.round(left)}px`, 'important');
        drawer.style.setProperty('right', 'auto', 'important');
        drawer.style.setProperty('width', `${drawerWidth}px`, 'important');
        drawer.style.setProperty('height', 'auto', 'important');

        if (isTopNav) {
            const top = Math.round(btnRect.bottom + 10);
            drawer.style.setProperty('top', `${top}px`, 'important');
            drawer.style.setProperty('bottom', 'auto', 'important');
            drawer.style.setProperty('max-height', `${Math.max(160, Math.round(window.innerHeight - top - 16))}px`, 'important');
            drawer.style.setProperty('transform-origin', 'top center', 'important');
        } else {
            const bottom = Math.max(16, Math.round(window.innerHeight - btnRect.top + 10));
            drawer.style.setProperty('bottom', `${bottom}px`, 'important');
            drawer.style.setProperty('top', 'auto', 'important');
            drawer.style.setProperty('max-height', `${Math.max(160, Math.round(window.innerHeight - bottom - 16))}px`, 'important');
            drawer.style.setProperty('transform-origin', 'bottom center', 'important');
        }
    };

    window.toggleSettingsDrawer = function() {
        const drawer = document.getElementById('settingsDrawer');
        const overlay = document.getElementById('settingsOverlay');
        const btn = document.getElementById('sba-side-settings-button') || document.querySelector('.hud-nav-link[aria-label="Settings"]');
        if (!drawer || isPublishedEditorLocked()) return;

        const isOpen = drawer.classList.contains('open') || document.body.classList.contains('sba-side-settings-open');
        const willOpen = !isOpen;

        document.body.classList.toggle('sba-side-settings-open', willOpen);
        drawer.classList.toggle('open', willOpen);
        overlay?.classList.toggle('open', willOpen);
        btn?.setAttribute('aria-expanded', String(willOpen));

        if (willOpen) {
            document.body.dataset.sbaPanelOpenedAt = String(Date.now());
            window.positionSettingsMiniGui();
            // Close editor sidebar if open
            const editorEl = document.getElementById('editor');
            if (editorEl) editorEl.classList.remove('open');
        }
    };

    window.addEventListener('resize', () => {
        const drawer = document.getElementById('settingsDrawer');
        if (drawer?.classList.contains('open') || document.body.classList.contains('sba-side-settings-open')) {
            window.positionSettingsMiniGui();
        }
    }, { passive: true });

    document.addEventListener('pointerdown', (e) => {
        const drawer = document.getElementById('settingsDrawer');
        const btn = document.getElementById('sba-side-settings-button') || document.querySelector('.hud-nav-link[aria-label="Settings"]');
        if (!drawer) return;

        const isOpen = drawer.classList.contains('open') || document.body.classList.contains('sba-side-settings-open');
        if (!isOpen) return;

        const openedAt = Number(document.body.dataset.sbaPanelOpenedAt || '0');
        if (Date.now() - openedAt < 120) return;

        if (drawer.contains(e.target) || btn?.contains(e.target)) return;

        document.body.classList.remove('sba-side-settings-open');
        drawer.classList.remove('open');
        document.getElementById('settingsOverlay')?.classList.remove('open');
        btn?.setAttribute('aria-expanded', 'false');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const drawer = document.getElementById('settingsDrawer');
            const overlay = document.getElementById('settingsOverlay');
            const btn = document.getElementById('sba-side-settings-button') || document.querySelector('.hud-nav-link[aria-label="Settings"]');
            if (drawer?.classList.contains('open') || document.body.classList.contains('sba-side-settings-open')) {
                document.body.classList.remove('sba-side-settings-open');
                drawer?.classList.remove('open');
                overlay?.classList.remove('open');
                btn?.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // ── Editor Top Auto-Revealing Action Bar Engine ───────────────────────────
    function initializeEditorTopBar() {
        const topBar = document.getElementById('editor-top-bar');
        const trigger = document.getElementById('editor-top-bar-trigger');
        if (!topBar) return;

        let hideTimer = null;

        const reveal = () => {
            if (isPublishedEditorLocked()) return;
            if (hideTimer) {
                clearTimeout(hideTimer);
                hideTimer = null;
            }
            topBar.classList.add('is-revealed');
        };

        const scheduleHide = (delay = 240) => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                if (!topBar.matches(':hover') && !topBar.matches(':focus-within')) {
                    topBar.classList.remove('is-revealed');
                }
                hideTimer = null;
            }, delay);
        };

        window.addEventListener('pointermove', (event) => {
            if (isPublishedEditorLocked()) return;
            // Reveal if pointer is within 36px of the top edge
            if (event.clientY <= 36) {
                reveal();
            } else if (event.clientY > 90) {
                if (!topBar.matches(':hover') && !topBar.matches(':focus-within')) {
                    scheduleHide(160);
                }
            }
        }, { passive: true });

        topBar.addEventListener('pointerenter', reveal);
        topBar.addEventListener('pointerleave', () => scheduleHide(200));
        topBar.addEventListener('focusin', reveal);
        topBar.addEventListener('focusout', () => scheduleHide(250));

        if (trigger) {
            trigger.addEventListener('pointerenter', reveal);
        }

        window.toggleTopBarProgression = function(kind) {
            const prop = kind === 'ssr' ? 'showSsrProgression' : 'showTurProgression';
            const currentVal = window[prop] !== false;
            const nextVal = !currentVal;
            if (typeof window.setProgressionDisplay === 'function') {
                window.setProgressionDisplay(kind, nextVal);
            } else {
                window[prop] = nextVal;
                const hiddenInput = document.getElementById(kind === 'ssr' ? 'sidebar-show-ssr-progression' : 'sidebar-show-tur-progression');
                if (hiddenInput) hiddenInput.checked = nextVal;
            }
            const btn = document.getElementById(kind === 'ssr' ? 'topbar-toggle-ssr' : 'topbar-toggle-tur');
            if (btn) {
                btn.classList.toggle('active', nextVal);
                btn.setAttribute('aria-pressed', String(nextVal));
            }
        };

        const syncProgressionButtons = () => {
            const ssrBtn = document.getElementById('topbar-toggle-ssr');
            const turBtn = document.getElementById('topbar-toggle-tur');
            if (ssrBtn) {
                const isSsr = window.showSsrProgression !== false;
                ssrBtn.classList.toggle('active', isSsr);
                ssrBtn.setAttribute('aria-pressed', String(isSsr));
            }
            if (turBtn) {
                const isTur = window.showTurProgression !== false;
                turBtn.classList.toggle('active', isTur);
                turBtn.setAttribute('aria-pressed', String(isTur));
            }
        };

        syncProgressionButtons();
        window.addEventListener('load', syncProgressionButtons);

        if (typeof window.syncProgressionDisplayControls === 'function') {
            const prevSync = window.syncProgressionDisplayControls;
            window.syncProgressionDisplayControls = function() {
                prevSync.apply(this, arguments);
                syncProgressionButtons();
            };
        }
    }

    if (document.readyState !== 'loading') {
        initializeEditorTopBar();
    }
})();
