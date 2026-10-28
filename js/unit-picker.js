(() => {
    'use strict';
    const instances = new Map();
    const entries = new Set();
    let activePicker = null;
    const focusSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    function normalizedSearch(value) { return String(value || '').trim().toLocaleLowerCase(); }
    function visibleControls(root) {
        return [...root.querySelectorAll(focusSelector)].filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && !node.closest('[hidden],[inert]'));
    }
    function bindLifecycle(state) {
        state.dialog.setAttribute('role', 'dialog');
        state.dialog.setAttribute('aria-modal', 'true');
        state.dialog.tabIndex = -1;
        state.closeButton?.setAttribute('aria-label', state.config.closeLabel || 'Close character picker');
        state.closeButton?.addEventListener('click', () => close(state.id));
        state.root.addEventListener('click', event => { if (event.target === state.root) close(state.id); });
        state.dialog.addEventListener('keydown', event => {
            if (!state.open) return;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(state.id); return; }
            const controls = visibleControls(state.dialog);
            if (event.key === 'Tab') {
                const first = controls[0], last = controls.at(-1);
                if (!first) { event.preventDefault(); state.dialog.focus(); }
                else if (event.shiftKey && (document.activeElement === first || !state.dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || !state.dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
            }
            if (!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(event.key) || !state.grid?.contains(document.activeElement)) return;
            const cards = visibleControls(state.grid);
            const index = cards.indexOf(document.activeElement);
            if (index < 0) return;
            let next = index;
            if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = cards.length - 1;
            else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next += event.key === 'ArrowRight' ? 1 : -1;
            else {
                const current = cards[index].getBoundingClientRect();
                const downward = event.key === 'ArrowDown';
                const candidates = cards.map((node, i) => ({node, i, rect: node.getBoundingClientRect()})).filter(candidate => downward ? candidate.rect.top > current.top + 2 : candidate.rect.top < current.top - 2);
                candidates.sort((a,b) => Math.abs(a.rect.top-current.top)-Math.abs(b.rect.top-current.top) || Math.abs(a.rect.left-current.left)-Math.abs(b.rect.left-current.left));
                next = candidates[0]?.i ?? index;
            }
            event.preventDefault();
            cards[Math.max(0,Math.min(cards.length-1,next))]?.focus();
        });
    }
    function controlsApi(state) {
        return Object.freeze({
            refresh: () => { if (!state.external) filterAndRender(state); },
            setFilter: predicate => { state.extraFilter = typeof predicate === 'function' ? predicate : null; if (!state.external) filterAndRender(state); },
            setQuery: query => { if (!state.searchInput) return; state.searchInput.value = String(query || ''); state.searchInput.dispatchEvent(new Event('input',{bubbles:true})); },
            update: patch => update(state.id,patch),
            close: options => close(state.id,options)
        });
    }
    function mountControls(state) {
        if (!state.controls) return;
        state.disposeControls?.();
        state.disposeControls = null;
        state.controls.replaceChildren();
        const api = controlsApi(state);
        if (typeof state.config.mountControls === 'function') {
            const dispose = state.config.mountControls(state.controls,api);
            if (typeof dispose === 'function') state.disposeControls = dispose;
            return;
        }
        const label = makeElement('p','abs-picker-controls-label',state.config.controlsLabel || 'Characters');
        const reset = makeElement('button','picker-source-tab','Clear search');
        reset.type = 'button';
        reset.addEventListener('click',()=>{api.setQuery('');state.searchInput?.focus();});
        state.controls.append(label,reset);
    }
    function buildPicker(id,root,config) {
        root.classList.add('calc-unit-picker-backdrop');
        root.hidden = true;
        root.replaceChildren();
        const dialog = makeElement('section',`calc-unit-picker-dialog liquid-glass-surface ${config.dialogClass || ''}`.trim());
        const header = makeElement('header','calc-picker-header');
        const title = makeElement('h2','calc-picker-title-text',config.title || 'Select Unit');
        title.id = `${id}-title`;
        dialog.setAttribute('aria-labelledby',title.id);
        const closeButton = makeElement('button','calc-picker-close-btn','×');
        closeButton.type = 'button';
        header.append(title,closeButton);
        const toolbar = makeElement('div','calc-picker-toolbar');
        const label = makeElement('label','picker-search-wrapper');
        const icon = makeElement('span','picker-search-icon','⌕');
        icon.setAttribute('aria-hidden','true');
        const searchInput = makeElement('input');
        searchInput.type = 'search'; searchInput.autocomplete = 'off';
        const grid = makeElement('div','calc-picker-grid');
        grid.id = config.gridId || `${id}-grid`;
        grid.setAttribute('role','group');
        searchInput.setAttribute('aria-controls',grid.id);
        label.append(icon,searchInput);
        const controls = makeElement('aside','picker-controls-row');
        controls.setAttribute('aria-label','Character filters and actions');
        toolbar.append(label,controls);
        const viewport = makeElement('div','calc-picker-grid-viewport');
        viewport.append(grid);
        const footer = makeElement('div','lc-unit-picker-footer');
        const count = makeElement('span','lc-unit-picker-count');
        count.setAttribute('role','status');count.setAttribute('aria-live','polite');
        const loadMore = makeElement('button','lc-unit-picker-more',config.moreLabel || 'Show more');
        loadMore.type = 'button';loadMore.setAttribute('aria-controls',grid.id);
        footer.append(count,loadMore);
        dialog.append(header,toolbar,viewport,footer);
        root.append(dialog);
        const state = {id,root,dialog,title,closeButton,searchInput,controls,grid,count,loadMore,config,filteredItems:[],visibleCount:0,open:false};
        instances.set(id,state);
        bindLifecycle(state);
        searchInput.addEventListener('input',()=>filterAndRender(state));
        loadMore.addEventListener('click',()=>{state.visibleCount += Math.max(1,Number(state.config.pageSize)||100);render(state);});
        const sentinel = makeElement('div','picker-scroll-sentinel');
        sentinel.setAttribute('aria-hidden','true');
        viewport.append(sentinel);
        state.sentinel = sentinel;
        state.scrollObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
            if (!state.open || !state.config.infiniteScroll || !entries.some(entry => entry.isIntersecting) || state.visibleCount >= state.filteredItems.length) return;
            state.visibleCount += Math.max(1,Number(state.config.pageSize)||100);
            render(state,true);
        }, {root:viewport,rootMargin:'0px 0px 120px 0px'}) : null;
        return state;
    }
    function filterAndRender(state) {
        const query = normalizedSearch(state.searchInput.value);
        const search = state.config.getSearchText || (()=>'');
        state.filteredItems = (Array.isArray(state.config.items)?state.config.items:[]).filter(item =>
            (!state.config.filterItem || state.config.filterItem(item)) && (!state.extraFilter || state.extraFilter(item)) && (!query || normalizedSearch(search(item)).includes(query)));
        state.visibleCount = Math.max(1,Number(state.config.pageSize)||100);
        render(state);
    }
    function render(state, append = false) {
        if (!state.open) return;
        state.scrollObserver?.disconnect();
        if (!append) state.grid.replaceChildren();
        const pending = Boolean(state.config.loading), error = state.config.error;
        state.grid.setAttribute('aria-busy',String(pending));
        const items = pending || error ? [] : state.filteredItems;
        const start = append ? state.renderedCount : 0;
        items.slice(start,state.visibleCount).forEach((item,index)=>{
            const card = state.config.renderItem(item,start + index);
            if (!(card instanceof Element)) return;
            card.addEventListener('click',event=>{
                if (event.defaultPrevented || card.matches(':disabled') || state.config.canSelect?.(item)===false) return;
                const callback = state.config.onSelect;
                const animateViewerExit = canAnimateViewer(state);
                close(state.id,{restoreFocus:animateViewerExit,reason:'select',afterClose:animateViewerExit ? () => callback(item) : undefined});
                if (!animateViewerExit) callback(item);
            });
            if (state.config.isSelected?.(item)) card.classList.add('is-current');
            state.grid.append(card);
        });
        if (!items.length) {
            const message = pending ? (state.config.loadingMessage || 'Loading characters…') : error ? String(error) : (state.config.emptyMessage || 'No matching characters were found.');
            const empty = makeElement('p','lc-unit-picker-empty',message);
            empty.setAttribute('role',error?'alert':'status');state.grid.append(empty);
            if (error && typeof state.config.onRetry === 'function') {
                const retry = makeElement('button','lc-unit-picker-more','Try again');retry.type='button';retry.addEventListener('click',()=>state.config.onRetry());state.grid.append(retry);
            }
        }
        state.count.textContent = pending ? 'Loading' : error ? 'Could not load characters' : items.length ? `Showing ${Math.min(state.visibleCount,items.length).toLocaleString()} of ${items.length.toLocaleString()}` : '0 characters';
        state.loadMore.hidden = pending || Boolean(error) || items.length<=state.visibleCount;
        state.renderedCount = Math.min(state.visibleCount,items.length);
        state.loadMore.parentElement.hidden = Boolean(state.config.infiniteScroll && state.scrollObserver);
        state.sentinel.hidden = !state.config.infiniteScroll || !state.scrollObserver || pending || Boolean(error) || state.visibleCount >= items.length;
        if (!state.sentinel.hidden) state.scrollObserver.observe(state.sentinel);
    }
    function viewerAnimationDuration(state) {
        if (state.config.presentation !== 'abs-viewer') return 0;
        const duration = Number(state.config.animationDuration);
        return Number.isFinite(duration) ? Math.max(0, Math.min(500, duration)) : 0;
    }
    function canAnimateViewer(state) {
        return state.config.presentation === 'abs-viewer'
            && state.root.dataset.pickerOrigin === 'viewer'
            && viewerAnimationDuration(state) > 0
            && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    }
    function cancelViewerAnimation(state) {
        for (const key of ['dialogAnimation','backdropAnimation']) {
            try { state[key]?.cancel(); } catch (error) {}
            state[key] = null;
        }
        state.animationDirection = null;
    }
    function playViewerAnimation(state, direction) {
        const duration = viewerAnimationDuration(state);
        if (!state.dialogAnimation || !state.backdropAnimation) {
            const timing = {duration,easing:'cubic-bezier(.42,0,.58,1)',fill:'both'};
            state.dialogAnimation = state.dialog.animate([
                {opacity:0,transform:'scale(.05)',offset:0},
                {opacity:1,transform:'scale(1)',offset:1}
            ],timing);
            state.backdropAnimation = state.root.animate([{opacity:0},{opacity:1}],timing);
            state.animationDirection = 'open';
            if (direction === 'close') {
                state.dialogAnimation.finish();
                state.backdropAnimation.finish();
            }
        }
        if (direction !== state.animationDirection) {
            state.dialogAnimation.reverse();
            state.backdropAnimation.reverse();
            state.animationDirection = direction;
        } else {
            state.dialogAnimation.play();
            state.backdropAnimation.play();
        }
        return Promise.all([
            state.dialogAnimation.finished.catch(() => null),
            state.backdropAnimation.finished.catch(() => null)
        ]);
    }
    function position(state) {
        const anchor = typeof state.config.anchor === 'string' ? document.querySelector(state.config.anchor) : state.config.anchor || document.getElementById('abs-main-sidebar');
        if (anchor && window.innerWidth>900) {
            const reserved = getComputedStyle(document.documentElement).getPropertyValue('--abs-nav-reserved-width').trim();
            const defaultRail = !state.config.anchor && anchor.id === 'abs-main-sidebar';
            state.root.style.setProperty('--abs-picker-anchor',state.config.presentation === 'abs-viewer' && defaultRail
                ? 'calc(var(--abs-nav-expanded, 224px) + var(--abs-shell-gap, 16px))'
                : (defaultRail && reserved
                    ? 'calc(var(--abs-nav-reserved-width) + var(--abs-shell-gap, 16px))'
                    : `${Math.max(0,anchor.getBoundingClientRect().right)+16}px`));
        }
        else state.root.style.removeProperty('--abs-picker-anchor');
        const origin = typeof state.config.origin === 'string' ? document.querySelector(state.config.origin) : state.config.origin;
        const visibleOrigin = origin?.getClientRects().length
            && !origin.closest('[hidden],[inert]') && getComputedStyle(origin).visibility !== 'hidden';
        if (visibleOrigin && ['abs-calculator','abs-viewer'].includes(state.config.presentation)) {
            const source = origin.getBoundingClientRect(), target = state.dialog.getBoundingClientRect();
            state.dialog.style.setProperty('--abs-picker-origin-x',`${source.left+source.width/2-target.left}px`);
            const localY = source.top+source.height/2-target.top;
            state.dialog.style.setProperty('--abs-picker-origin-y',`${state.config.presentation === 'abs-viewer' ? localY : Math.max(0,Math.min(target.height,localY))}px`);
            state.root.dataset.pickerOrigin = state.config.presentation === 'abs-viewer' ? 'viewer' : 'icon';
        } else {
            delete state.root.dataset.pickerOrigin;
            state.dialog.style.removeProperty('--abs-picker-origin-x');
            state.dialog.style.removeProperty('--abs-picker-origin-y');
        }
    }
    function activate(state) {
        const returnFocus = activePicker && activePicker !== state ? activePicker.previousFocus : document.activeElement;
        if (activePicker && activePicker!==state) close(activePicker.id,{restoreFocus:false,reason:'replace'});
        const viewerPresentation = state.config.presentation === 'abs-viewer';
        if (viewerPresentation) window.absNavigation?.setViewerPickerState('open');
        else window.absNavigation?.closeDrawers();
        if (!state.open) {
            state.previousFocus=returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus : document.activeElement;
            state.previousOverflow=document.body.style.overflow;
        }
        if(state.config.presentation)state.root.dataset.pickerPresentation=state.config.presentation;
        else delete state.root.dataset.pickerPresentation;
        delete state.root.dataset.pickerOrigin;
        delete state.root.dataset.pickerClosing;
        delete state.root.dataset.pickerOpening;
        state.root.removeAttribute('inert');
        state.dialog.setAttribute('aria-modal','true');
        const transitionToken = state.transitionToken = (state.transitionToken || 0) + 1;
        state.open=true;activePicker=state;
        document.body.style.overflow='hidden';
        state.root.hidden=false;state.root.removeAttribute('aria-hidden');
        if (state.external) state.root.style.display='flex';
        if (viewerPresentation && !state.external) filterAndRender(state);
        position(state);
        if (!state.external && !viewerPresentation) filterAndRender(state);
        (state.searchInput || visibleControls(state.dialog)[0] || state.dialog).focus();
        if (viewerPresentation && canAnimateViewer(state)) {
            state.root.dataset.pickerOpening='true';
            playViewerAnimation(state,'open').then(() => {
                if (state.transitionToken === transitionToken && state.open) delete state.root.dataset.pickerOpening;
            });
        } else if (viewerPresentation) {
            cancelViewerAnimation(state);
        }
        return state.root;
    }
    function open(config) {
        if (!config?.id || typeof config.renderItem!=='function' || typeof config.onSelect!=='function') throw new TypeError('Unit picker requires an id, renderItem callback, and onSelect callback.');
        let state=instances.get(config.id);
        if (state?.external) throw new TypeError('Use openEnhanced for an existing DOM picker.');
        if (!state) {
            const root=document.getElementById(config.id)||makeElement('div');root.id=config.id;
            if(root.parentElement!==document.body)document.body.append(root);
            state=buildPicker(config.id,root,config);
        }
        state.config=config;state.extraFilter=null;
        state.title.textContent=config.title || 'Select Unit';
        state.searchInput.placeholder=config.searchPlaceholder || 'Search characters…';
        state.searchInput.setAttribute('aria-label',config.searchLabel || 'Search characters');
        state.grid.setAttribute('aria-label',config.resultsLabel || 'Character choices');
        if(!state.open) state.searchInput.value=config.query || '';
        mountControls(state);
        return activate(state);
    }
    function update(id,patch={}) {
        const state=instances.get(id);if(!state)return false;
        state.config={...state.config,...patch};
        if('mountControls' in patch)mountControls(state);
        if(!state.external && state.open)filterAndRender(state);
        return true;
    }
    function enhance(rootOrId,options={}) {
        const root=typeof rootOrId==='string'?document.getElementById(rootOrId):rootOrId;
        if(!root?.id)return null;
        const existing=instances.get(root.id);
        if(existing){existing.config={...existing.config,...options};return root;}
        const dialog=root.querySelector('.calc-unit-picker-dialog') || root.querySelector('[role="dialog"]') || root;
        root.classList.add('calc-unit-picker-backdrop');
        const title=dialog.querySelector('.calc-picker-title-text');
        if(title){title.id ||= `${root.id}-title`;dialog.setAttribute('aria-labelledby',title.id);}
        else dialog.setAttribute('aria-label',options.title || 'Select character');
        const searchInput=dialog.querySelector('input[type="search"],.picker-search-wrapper input');
        searchInput?.setAttribute('aria-label',options.searchLabel || 'Search characters');
        const state={id:root.id,root,dialog,title,searchInput,grid:dialog.querySelector('.calc-picker-grid'),closeButton:dialog.querySelector('.calc-picker-close-btn'),config:options,external:true,open:false};
        instances.set(root.id,state);bindLifecycle(state);
        const observer=new MutationObserver(()=>{if(state.open&&(root.hidden||root.style.display==='none'))close(root.id);});
        observer.observe(root,{attributes:true,attributeFilter:['hidden','style']});
        state.observer=observer;
        return root;
    }
    function openEnhanced(id,options={}) {
        const root=enhance(id,options);const state=root&&instances.get(root.id);
        return state ? activate(state) : null;
    }
    function openOnEntry(config,{key=config?.id,required=true,hasValidSelection=false,intentionalDraft=false}={}) {
        const entryKey=`${config?.id}:${key}`;
        if(entries.has(entryKey))return false;
        entries.add(entryKey);
        const value=option=>typeof option==='function'?option():option;
        if(!value(required)||value(hasValidSelection)||value(intentionalDraft))return false;
        return instances.get(config?.id)?.external ? openEnhanced(config.id,config) : open(config);
    }
    function finishClose(state,{reason,afterClose}={}) {
        if (state.open) return false;
        state.root.hidden=true;
        state.root.setAttribute('aria-hidden','true');
        if (state.external) state.root.style.display='none';
        if (state.config.presentation === 'abs-viewer') {
            state.root.removeAttribute('inert');
            state.dialog.setAttribute('aria-modal','false');
            delete state.root.dataset.pickerClosing;
            delete state.root.dataset.pickerOpening;
            delete state.root.dataset.pickerOrigin;
            state.dialog.style.removeProperty('--abs-picker-origin-x');
            state.dialog.style.removeProperty('--abs-picker-origin-y');
            cancelViewerAnimation(state);
            window.absNavigation?.setViewerPickerState('closed');
        }
        state.config.onClose?.({reason});
        afterClose?.();
        return true;
    }
    function close(id,{restoreFocus=true,reason='dismiss',afterClose}={}) {
        const state=id?instances.get(id):activePicker;
        if(!state?.open)return false;
        state.scrollObserver?.disconnect();
        const viewerPresentation = state.config.presentation === 'abs-viewer';
        const animateViewerExit = viewerPresentation && state.config.animateClose !== false && reason !== 'replace' && canAnimateViewer(state);
        state.open=false;
        state.root.setAttribute('aria-hidden','true');
        if (animateViewerExit) {
            state.root.inert=true;
            state.dialog.setAttribute('aria-modal','false');
            delete state.root.dataset.pickerOpening;
            state.root.dataset.pickerClosing='true';
        } else {
            state.root.hidden=true;
            if(state.external)state.root.style.display='none';
            if (viewerPresentation) {
                state.root.removeAttribute('inert');
                state.dialog.setAttribute('aria-modal','false');
                delete state.root.dataset.pickerOpening;
                delete state.root.dataset.pickerClosing;
            }
        }
        if(activePicker===state){document.body.style.overflow=state.previousOverflow;activePicker=null;}
        state.disposeControls?.();state.disposeControls=null;
        if (viewerPresentation) {
            state.config.onCloseStart?.({reason});
            window.absNavigation?.setViewerPickerState(animateViewerExit ? 'closing' : 'closed');
        }
        if(restoreFocus&&state.previousFocus?.isConnected)state.previousFocus.focus?.();
        if (animateViewerExit) {
            const transitionToken = state.transitionToken = (state.transitionToken || 0) + 1;
            playViewerAnimation(state,'close').then(() => {
                if (state.transitionToken === transitionToken && !state.open && state.root.dataset.pickerClosing === 'true') {
                    finishClose(state,{reason,afterClose});
                }
            });
        } else {
            finishClose(state,{reason,afterClose});
        }
        return true;
    }
    window.addEventListener('resize',()=>{if(activePicker)position(activePicker);},{passive:true});
    window.addEventListener('abs-shell-layout-change',()=>{if(activePicker)position(activePicker);});
    function portrait({name,type='agl',rarity='',image='',fallback='',frame='',custom=false,isEza=false,isSeza=false,isTransformed=false,onImageError,onSelect}) {
        const button = makeElement('button', 'picker-unit-card picker-type-' + type.toLowerCase());
        button.type = 'button'; button.dataset.type = type.toLowerCase();
        button.setAttribute('aria-label', [name,rarity,type.toUpperCase()].filter(Boolean).join(' · '));
        button.dataset.pickerTooltip = button.getAttribute('aria-label');
        Object.assign(button.dataset,{source:custom?'custom':'official',isEza:String(isEza),isSeza:String(isSeza),isTransformed:String(isTransformed)});
        const states=[custom?'custom card':'',isSeza?'Super Extreme Z-Awakened':isEza?'Extreme Z-Awakened':'',isTransformed?'transformed form':''].filter(Boolean);
        if(states.length)button.setAttribute('aria-label',button.getAttribute('aria-label')+' · '+states.join(', '));
        const wrap = makeElement('div','picker-thumb-wrapper');
        if (frame) { const border = makeElement('img','picker-frame'); border.src=frame;border.alt='';wrap.append(border); }
        const art = makeElement('img','picker-thumb' + (custom ? ' is-fallback-thumb' : ''));
        art.alt=''; art.loading='lazy'; if(image)art.src=image;
        if(onImageError)art.onerror=()=>onImageError(art);
        else art.addEventListener('error',()=>{if(fallback && art.src!==new URL(fallback,document.baseURI).href)art.src=fallback;else {art.removeAttribute('src');art.classList.add('picker-thumb-error');}});
        wrap.append(art);button.append(wrap);
        const badges=makeElement('span','picker-state-badges');badges.setAttribute('aria-hidden','true');
        for(const [state,label,enabled] of [['custom','CUSTOM',custom],['seza','SEZA',isSeza],['eza','EZA',isEza&&!isSeza],['form','FORM',isTransformed]]) {
            if(enabled){const badge=makeElement('span','picker-state-badge',label);badge.dataset.state=state;badges.append(badge);}
        }
        if(badges.childNodes.length)wrap.append(badges);
        if(onSelect)button.addEventListener('click',onSelect);
        return button;
    }
    function categoryNames(card) {
        const raw = (window.DB?.cards || []).find(c=>String(c.id)===String(card.id)) || card;
        const ids = card.categoryIds || raw.categories || [];
        return [...new Set([...(card.categoryNames || []),...ids.map(id=>window.DB?.categories?.[id]?.name || String(id))])];
    }
    function mountCharacterFilters(host,{items,onChange,typeOf=card=>card.type || 'agl'}) {
        host.querySelector('[data-shared-character-filters]')?.remove();
        const group=makeElement('div','shared-character-filters');group.dataset.sharedCharacterFilters='true';
        const type=makeElement('select');type.setAttribute('aria-label','Character type');
        for(const value of ['all','agl','teq','int','str','phy']) {const o=makeElement('option','',value==='all'?'All types':value.toUpperCase());o.value=value;type.append(o);}
        const category=makeElement('select');category.setAttribute('aria-label','Character category');
        const all=makeElement('option','','All categories');all.value='';category.append(all);
        group.updateItems=cards=>{
            const existing=new Set([...category.options].map(o=>o.value));
            [...new Set(cards.flatMap(categoryNames))].sort().forEach(name=>{if(!existing.has(name)){const o=makeElement('option','',name);o.value=name;category.append(o);}});
        };
        group.updateItems(items);
        const change=()=>onChange(card=>(type.value==='all'||String(typeOf(card)).toLowerCase()===type.value)&&(!category.value||categoryNames(card).includes(category.value)));
        type.addEventListener('change',change);category.addEventListener('change',change);
        group.append(type,category);host.append(group);
        return group;
    }
    window.DokkanUnitPicker=Object.freeze({portrait,mountCharacterFilters,categoryNames,open,close,isOpen:id=>Boolean((id?instances.get(id):activePicker)?.open),update,enhance,openEnhanced,openOnEntry});
})();
