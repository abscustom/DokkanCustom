/* ==========================================================================
   absCustom Hub - Dokkan Battle News Integration Engine
   ========================================================================== */

const DOKKAN_NO_NEWS_IMG = 'https://abscustom.github.io/assets/images/no_news.png';

function newsSvgIcon(name, className = '') {
    const paths = {
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="16" y1="3" x2="16" y2="7"></line><line x1="8" y1="3" x2="8" y2="7"></line><line x1="3" y1="11" x2="21" y2="11"></line>',
        clock: '<circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15 14"></polyline>',
        campaign: '<path d="M12 3v18"></path><path d="M5 8h14"></path><path d="M6 8c0 3.5 2.7 6 6 6s6-2.5 6-6"></path><path d="M8 21h8"></path>',
        summon: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"></path><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"></path>',
        event: '<path d="M14.5 4.5l5 5-8.5 8.5-5-5L14.5 4.5z"></path><path d="M12 7l5 5"></path><path d="M4 20l5-5"></path>',
        lightning: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
        warning: '<path d="M10.3 3.5L2.4 17.2A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.8L13.7 3.5a2 2 0 0 0-3.4 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
        news: '<path d="M4 5h16v14H4z"></path><path d="M7 9h6"></path><path d="M7 13h10"></path><path d="M7 17h8"></path>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="8.5" cy="9" r="1.5"></circle><path d="M21 15l-5-5L5 20"></path>',
        video: '<rect x="3" y="5" width="13" height="14" rx="2"></rect><path d="M16 10l5-3v10l-5-3z"></path>',
        chat: '<path d="M21 11.5a8 8 0 0 1-8.5 8 9.4 9.4 0 0 1-3.8-.8L3 20l1.3-4.2A7.8 7.8 0 0 1 4 13.5a8 8 0 0 1 8.5-8 8 8 0 0 1 8.5 6z"></path><circle cx="8" cy="12" r=".7" fill="currentColor"></circle><circle cx="12" cy="12" r=".7" fill="currentColor"></circle><circle cx="16" cy="12" r=".7" fill="currentColor"></circle>',
        refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.7L3 9"></path><path d="M3 4v5h5"></path><path d="M4 13a8 8 0 0 0 14.5 4.7L21 15"></path><path d="M21 20v-5h-5"></path>',
        check: '<path d="M20 6L9 17l-5-5"></path>',
        external: '<path d="M14 3h7v7"></path><path d="M10 14L21 3"></path><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"></path>',
        previous: '<polyline points="15 18 9 12 15 6"></polyline>',
        next: '<polyline points="9 18 15 12 9 6"></polyline>'
    };
    return `<svg class="news-inline-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.news}</svg>`;
}

function normalizeDokkanNewsUrl(u) {
    if (!u || typeof u !== 'string') return null;
    let clean = u.split('?')[0].trim();
    if (clean.includes('aktsk.com/banners/')) {
        const pathPart = clean.split('aktsk.com/banners/')[1];
        return `https://enaskhebnjtktdfszdcb.supabase.co/storage/v1/object/public/assets/mirror/banners/${pathPart}`;
    }
    if (clean.includes('aktsk.com/')) {
        const pathPart = clean.split('aktsk.com/')[1];
        return `https://enaskhebnjtktdfszdcb.supabase.co/storage/v1/object/public/assets/mirror/${pathPart}`;
    }
    return clean;
}

function canUseLocalNewsBridge() {
    return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

function staticNewsUrl(fileName) {
    // GitHub Pages and browsers can cache JSON for longer than the site files.
    return `json/${fileName}?v=${Date.now()}`;
}

function escapeNewsHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

class DokkanNewsEngine {
    constructor() {
        this.articles = [];
        this.discordArticles = [];
        this.discordBatches = [];
        this.currentNewsSource = 'game'; // 'discord' | 'game'
        this.currentNewsFeed = 'all'; // 'all' | 'discord' | 'game'
        this.recentCharacterCards = [];
        this.currentArticleId = null;
        this.activeArticleView = null;
        this.currentCategory = 'all';
        this.newsSortOrder = 'newest';
        this.searchQuery = '';
        this.isLoading = false;
        this.isServerConnected = false;
        this.featuredNewsIndex = 0;
        this.featuredRotationTimer = null;
        this.featuredRotationIsTransitioning = false;
        this.featuredShouldFadeIn = false;

        // Rotating Home News Slides System
        this.currentHomeSlide = 1;
        this.slideSecondsRemaining = 10;
        this.slideTimer = null;
        this.slideIntervalMs = 10000; // 10 seconds per slide
        this.isSlidePaused = false;
        this.hasAttachedSnippetHover = false;
        this.campaignGallery = [];
        this.currentGalleryIndex = 0;
    }

    /**
     * Translates Akatsuki game markup into styled modern HTML
     * Supports {color:#HEX}, {size:NUM}, {outline:#HEX}, {duration:...}, {date:...}, {link:...}
     */
    parseDokkanMarkup(text) {
        if (!text) return '';
        let t = String(text);

        // 1. Text Outline / Stroke Tag: {outline:#FF0000,2}...{outline}
        t = t.replace(/{outline:(#[0-9a-fA-F]{6})(?:,(\d+))?}([\s\S]*?){outline}/gi, (match, color, width, content) => {
            const strokeColor = color || '#ff0000';
            return `<span class="dokkan-text-outline" style="text-shadow: -1px -1px 0 ${strokeColor}, 1px -1px 0 ${strokeColor}, -1px 1px 0 ${strokeColor}, 1px 1px 0 ${strokeColor}, 0 0 8px ${strokeColor}; font-weight: 900;">${content}</span>`;
        });

        // 2. Color Tag: {color:#FFFF00}...{color}
        t = t.replace(/{color:(#[0-9a-fA-F]{6})}([\s\S]*?){color}/gi, (match, color, content) => {
            return `<span style="color: ${color}; font-weight: 700;">${content}</span>`;
        });

        // 3. Size Tag: {size:24}...{size}
        t = t.replace(/{size:(\d+)}([\s\S]*?){size}/gi, (match, sizeNum, content) => {
            const s = Math.max(12, Math.min(32, parseInt(sizeNum, 10)));
            return `<span style="font-size: ${s}px; font-weight: 800; display: inline-block; margin: 4px 0; letter-spacing: 0.3px;">${content}</span>`;
        });

        // 4. Link Tag: {link:https://x.com/...}>Official X<{link}
        t = t.replace(/{link:([^}]+)}>([\s\S]*?)<{link}/gi, (match, url, label) => {
            return `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer" class="dokkan-news-interactive-link"><span>${label.trim()}</span>${newsSvgIcon('external')}</a>`;
        });
        t = t.replace(/{link:([^}]+)}([\s\S]*?){link}/gi, (match, url, label) => {
            return `<a href="${url.trim()}" target="_blank" rel="noopener noreferrer" class="dokkan-news-interactive-link"><span>${label.trim()}</span>${newsSvgIcon('external')}</a>`;
        });

        // 5. Duration / Event Period Tag: {duration:1787374800,1787979540,DT,U}
        t = t.replace(/{duration:(\d+),(\d+)(?:,[^}]*)?}/gi, (match, startTs, endTs) => {
            const d1 = new Date(parseInt(startTs, 10) * 1000);
            const d2 = new Date(parseInt(endTs, 10) * 1000);
            const options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
            const s1 = d1.toLocaleDateString('en-US', options);
            const s2 = d2.toLocaleDateString('en-US', options);
            return `<div class="dokkan-period-badge"><span class="period-icon">${newsSvgIcon('calendar')}</span> <strong>Event Period:</strong> ${s1} ~ ${s2}</div>`;
        });

        // 6. Single Date Tag: {date:1787461200,T,L}
        t = t.replace(/{date:(\d+)(?:,[^}]*)?}/gi, (match, ts) => {
            const d = new Date(parseInt(ts, 10) * 1000);
            const str = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
            return `<span class="dokkan-timestamp-pill">${newsSvgIcon('clock')} ${str}</span>`;
        });

        // 7. Linebreaks
        t = t.replace(/\r\n|\r|\n/g, '<br>');

        // 8. Clean any remaining unparsed tags
        t = t.replace(/{[^{}]+}/g, '');

        return t;
    }

    /**
     * Categorizes an article based on title and content keywords
     */
    detectCategory(title = '', bodyText = '') {
        const text = (title + ' ' + bodyText).toLowerCase();
        if (text.includes('campaign') || text.includes('countdown') || text.includes('celebration') || text.includes('anniversary')) return 'campaign';
        if (text.includes('summon') || text.includes('festival') || text.includes('carnival') || text.includes('ticket') || text.includes('banner')) return 'summon';
        if (text.includes('extreme z-battle') || text.includes('super eza') || text.includes('event') || text.includes('challenge') || text.includes('story')) return 'event';
        if (text.includes('issue') || text.includes('maintenance') || text.includes('bug') || text.includes('notice') || text.includes('compensation')) return 'notice';
        if (text.includes('update') || text.includes('version') || text.includes('shop') || text.includes('data download')) return 'update';
        return 'general';
    }

    getCategoryBadge(category) {
        switch (category) {
            case 'discord':  return `<span class="news-cat-badge badge-discord">DISCORD</span>`;
            case 'campaign': return `<span class="news-cat-badge badge-campaign">CAMPAIGN</span>`;
            case 'summon':   return `<span class="news-cat-badge badge-summon">SUMMON</span>`;
            case 'event':    return `<span class="news-cat-badge badge-event">EVENT</span>`;
            case 'update':   return `<span class="news-cat-badge badge-update">UPDATE</span>`;
            case 'notice':   return `<span class="news-cat-badge badge-notice">NOTICE</span>`;
            default:         return `<span class="news-cat-badge badge-general">NEWS</span>`;
        }
    }

    /**
     * Loads the master news dataset
     * Priority: 1) Local Node/Express server (http://localhost:3001) -> 2) Static JSON fallback (json/dokkan_news.json)
     */
    async init() {
        this.isLoading = true;
        const recentCardsPromise = this.loadRecentCharacterCards();
        let loadedData = null;

        // The local bridge only exists while viewing the site from this computer.
        if (canUseLocalNewsBridge()) {
            try {
                const res = await fetch('http://localhost:3001/api/dokkan-news-all', { signal: AbortSignal.timeout(1200) });
                if (res.ok) {
                    loadedData = await res.json();
                    this.isServerConnected = true;
                    console.log(`[Dokkan News] Connected to local live bridge. Loaded ${loadedData.length} articles.`);
                }
            } catch (e) {
                // Server offline or timed out -> Fallback to static bundled JSON
            }
        }

        if (!loadedData) {
            try {
                const res = await fetch(staticNewsUrl('dokkan_news.json'), { cache: 'no-store' });
                if (res.ok) {
                    loadedData = await res.json();
                    console.log(`[Dokkan News] Loaded ${loadedData.length} articles from the static fallback.`);
                }
            } catch (e) {
                console.warn("[Dokkan News] Could not load news JSON fallback:", e);
            }
        }

        if (Array.isArray(loadedData) && loadedData.length > 0) {
            this.articles = loadedData.map(item => {
                const ann = item.details?.announcement || item.announcement || {};
                const bodyText = (ann.bodies || []).map(b => b.description || '').join(' ');
                
                const cleanBodies = (ann.bodies || []).map(b => ({
                    ...b,
                    image: normalizeDokkanNewsUrl(b.image) || b.image
                }));

                const bannerImg = normalizeDokkanNewsUrl(ann.banner) || (cleanBodies && cleanBodies[0] ? cleanBodies[0].image : null) || (cleanBodies && cleanBodies.find(s => s.image)?.image) || null;

                // Derive formatted date from start_at epoch timestamp if available
                let dateStr = item.date_added;
                const startEpoch = ann.start_at || ann.new_appear_at;
                if (typeof startEpoch === 'number' && startEpoch > 0) {
                    const d = new Date(startEpoch * 1000);
                    if (!isNaN(d.getTime())) {
                        const y = d.getUTCFullYear();
                        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(d.getUTCDate()).padStart(2, '0');
                        dateStr = `${y}-${m}-${day}`;
                    }
                }

                return {
                    id: item.id || ann.id,
                    title: (ann.title || item.title || 'Dokkan Announcement').replace(/\r\n|\n/g, ' '),
                    date_added: dateStr || 'Recent',
                    start_at: startEpoch || 0,
                    banner: bannerImg,
                    category: this.detectCategory(ann.title || item.title, bodyText),
                    bodies: cleanBodies,
                    rawAnnouncement: ann
                };
            });

            // Sort chronologically by in-game event start date (start_at descending), then by id DESC
            this.articles.sort((a, b) => {
                const timeA = a.start_at || 0;
                const timeB = b.start_at || 0;
                if (timeA !== timeB) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            });

            this.filteredArticles = [...this.articles];
            this.currentArticleId = this.articles[0].id;
        }

        // Load Discord Channel Announcements
        let loadedDiscord = null;
        if (canUseLocalNewsBridge()) {
            try {
                const dRes = await fetch('http://localhost:3001/api/discord-news', { signal: AbortSignal.timeout(1000) });
                if (dRes.ok) loadedDiscord = await dRes.json();
            } catch (e) {}
        }

        if (!loadedDiscord) {
            try {
                const dRes = await fetch(staticNewsUrl('discord_news.json'), { cache: 'no-store' });
                if (dRes.ok) loadedDiscord = await dRes.json();
            } catch (e) {}
        }

        if (Array.isArray(loadedDiscord) && loadedDiscord.length > 0) {
            this.discordArticles = loadedDiscord;
            this.prepareDiscordBatches();
            console.log(`[Discord News] Prepared ${this.discordBatches.length} release batches across ${this.discordArticles.length} channel posts.`);
        } else {
            this.discordArticles = [];
            this.discordBatches = [];
        }

        await recentCardsPromise;

        // Set initial active article ID based on default source
        const initialList = this.getActiveArticles();
        if (initialList && initialList.length > 0) {
            this.currentArticleId = initialList[0].id;
        }

        this.isLoading = false;

        // Render widgets on load
        this.renderHomeSnippet();
        this.renderNewsSection();

        // A home-news link can be shared or refreshed without losing the exact
        // article the visitor chose.
        const pageParams = new URLSearchParams(window.location.search);
        const requestedArticleId = pageParams.get('article');
        if (pageParams.get('view') === 'news' && requestedArticleId) {
            this.openEnlargedArticle(requestedArticleId, pageParams.get('source') === 'discord' ? 'discord' : 'game');
        }
    }

    async loadRecentCharacterCards() {
        try {
            const response = await fetch(staticNewsUrl('cards.json'), { cache: 'no-store' });
            if (!response.ok) return;
            const cards = await response.json();
            if (!Array.isArray(cards)) return;

            const futureCutoff = Date.now() + 31 * 24 * 60 * 60 * 1000;
            // The release strip should show one representative card per
            // character: their highest available base card.  Transformation
            // cut-ins are deliberately excluded, and EZA/SEZA labels do not
            // create a second entry for the same character.
            const byCharacter = new Map();
            cards.forEach(card => {
                const releasedAt = new Date(String(card.open_at || '').replace(' ', 'T'));
                if (!card?.name || card.is_transform || Number.isNaN(releasedAt.getTime()) || releasedAt.getTime() > futureCutoff) return;

                const rawId = Number(card.id) || 0;
                const cutInId = Math.floor(rawId / 10) * 10;
                if (!cutInId) return;

                const displayName = String(card.name).replace(/\s*\((?:S?EZA)\)\s*$/i, '').trim();
                const characterKey = displayName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                const formRank = (Number(card.rarity || 0) * 100)
                    + (card.is_seza ? 20 : card.is_eza ? 10 : 0)
                    + Number(card.max_level || 0) / 1000;
                const current = byCharacter.get(characterKey);
                if (!current || formRank > current.formRank || (formRank === current.formRank && rawId > current.id)) {
                    byCharacter.set(characterKey, {
                        id: rawId,
                        cutInId,
                        name: displayName,
                        releasedAt,
                        rarity: card.rarity || 0,
                        formRank
                    });
                }
            });

            this.recentCharacterCards = Array.from(byCharacter.values())
                .sort((a, b) => b.releasedAt - a.releasedAt || b.id - a.id)
                .slice(0, 16);
        } catch (error) {
            console.warn('[Dokkan News] Could not load recent character ticker:', error);
        }
    }

    formatCharacterReleaseDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(date).toUpperCase();
    }

    renderCharacterReleaseTicker() {
        if (!this.recentCharacterCards.length) return '';

        const cards = this.recentCharacterCards;
        // renderNewsSection is intentionally rebuilt for source/category
        // filters. Keep the CSS marquee on its current 72-second phase so
        // that rebuild never looks like the top release tape restarted.
        const marqueePhase = -(((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000) % 72).toFixed(3);
        const releaseCards = [...cards, ...cards, ...cards].map(card => {
            const name = escapeNewsHtml(card.name);
            const releaseDate = escapeNewsHtml(this.formatCharacterReleaseDate(card.releasedAt));
            const cutInSrc = `assets/card-art/cards/${card.cutInId}/card_${card.cutInId}_cutin.png`;
            return `
                <a class="sba-news-ticker-item" href="card.html?id=${card.id}" aria-label="Open ${name}, released ${releaseDate}" title="Open ${name}">
                    <span class="sba-news-ticker-thumb"><img src="${cutInSrc}" alt="" loading="lazy" onerror="this.hidden=true"></span>
                    <span class="sba-news-ticker-copy"><span class="sba-news-ticker-date">${releaseDate}</span><span class="sba-news-ticker-title">${name}</span></span>
                </a>`;
        }).join('');

        return `
            <section class="dokkan-news-snippet sba-character-release-ticker-top" aria-label="Recently released Dokkan characters">
                <button type="button" class="sba-news-ticker-brand" onclick="switchHubView('news')" aria-label="News releases">
                    <img class="sba-news-ticker-logo" src="https://abscustom.github.io/assets/images/abs_logo.png" alt="">
                    <span>NEWS</span>
                </button>
                <div class="sba-news-ticker-viewport"><div class="sba-news-ticker-track sba-character-release-track" style="animation-delay:${marqueePhase}s">${releaseCards}</div></div>
            </section>`;
    }

    /**
     * Groups Discord posts into structured Release Batches sorted by Date
     */
    prepareDiscordBatches() {
        if (!Array.isArray(this.discordArticles) || this.discordArticles.length === 0) {
            this.discordBatches = [];
            return;
        }

        const dateMap = new Map();

        this.discordArticles.forEach(post => {
            const dateKey = post.date || 'Recent';
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, []);
            }
            dateMap.get(dateKey).push(post);
        });

        this.discordBatches = Array.from(dateMap.entries()).map(([dateStr, posts], batchIdx) => {
            const rawMediaList = [];
            const allText = [];

            // Sort posts chronologically (oldest to newest)
            const sortedPosts = [...posts].sort((a, b) => {
                const tA = new Date(a.timestamp || 0).getTime();
                const tB = new Date(b.timestamp || 0).getTime();
                return tA - tB;
            });

            sortedPosts.forEach(p => {
                if (p.title && p.title.trim() && !p.title.startsWith('http')) allText.push(p.title.trim());
                if (p.desc && p.desc.trim()) allText.push(p.desc.trim());

                if (Array.isArray(p.media) && p.media.length > 0) {
                    p.media.forEach(m => {
                        rawMediaList.push({
                            url: m.url,
                            type: m.type || (/\.(mp4|webm|mov|m4v)$/i.test(m.url) ? 'video' : 'image'),
                            title: p.title || '',
                            desc: p.desc || ''
                        });
                    });
                } else if (Array.isArray(p.images) && p.images.length > 0) {
                    p.images.forEach(img => {
                        const isVid = /\.(mp4|webm|mov|m4v)$/i.test(img);
                        rawMediaList.push({
                            url: img,
                            type: isVid ? 'video' : 'image',
                            title: p.title || '',
                            desc: p.desc || ''
                        });
                    });
                }
            });

            // Separate videos and vertical images
            const videos = rawMediaList.filter(m => m.type === 'video');
            const rawImages = rawMediaList.filter(m => m.type === 'image');

            // 1. Assign chronological visual numbers (Visual 1 to Visual N based on upload sequence)
            rawImages.forEach((img, idx) => {
                img.visualNumber = idx + 1;
                img.title = `Visual ${idx + 1}`;
            });

            videos.forEach((vid, idx) => {
                vid.visualNumber = idx + 1;
                vid.title = vid.title || `Video ${idx + 1}`;
            });

            // 2. Sort vertical images array so the first uploaded visual (Visual 1) is shown FIRST
            const orderedImages = [...rawImages].sort((a, b) => (a.visualNumber || 0) - (b.visualNumber || 0));

            const allMedia = [...videos, ...orderedImages];

            // Use Visual 1 as the preview thumbnail if available
            const bannerImg = (orderedImages.length > 0 && orderedImages[0].url) 
                ? orderedImages[0].url 
                : ((videos.length > 0 && videos[0].url) ? DOKKAN_NO_NEWS_IMG : DOKKAN_NO_NEWS_IMG);
            
            const batchTitle = `Discord Announcement - ${dateStr}`;

            const bodies = allMedia.map((m, mIdx) => ({
                image: m.type === 'image' ? m.url : null,
                video: m.type === 'video' ? m.url : null,
                type: m.type,
                visualNumber: m.visualNumber,
                description: m.desc || (m.title && !m.title.startsWith('http') ? `{outline:#38bdf8,2}${m.title}{outline}` : '')
            }));

            if (allText.length > 0) {
                bodies.unshift({
                    description: allText.join('\n\n')
                });
            }

            return {
                id: `discord_batch_${batchIdx}`,
                title: batchTitle,
                category: 'discord',
                date_added: dateStr,
                date: dateStr,
                banner: bannerImg,
                mediaCount: allMedia.length,
                media: allMedia,
                bodies: bodies,
                isDiscord: true
            };
        }).filter(b => b.mediaCount > 0 || (b.bodies && b.bodies.some(body => body.description && body.description.trim().length > 0)));
    }

    getActiveArticles() {
        if (this.currentNewsSource === 'game') {
            return this.articles || [];
        }
        return (this.discordBatches && this.discordBatches.length > 0) ? this.discordBatches : this.articles;
    }

    getFilteredArticles() {
        const list = this.getActiveArticles();
        return list.filter(art => {
            const matchesCat = (this.currentCategory === 'all' || art.category === this.currentCategory);
            const matchesQuery = !this.searchQuery || 
                (art.title && art.title.toLowerCase().includes(this.searchQuery)) ||
                (art.date_added && art.date_added.toLowerCase().includes(this.searchQuery)) ||
                (art.bodies || []).some(b => (b.description || '').toLowerCase().includes(this.searchQuery));
            return matchesCat && matchesQuery;
        });
    }

    setNewsSource(source) {
        this.activeArticleView = null;
        this.currentNewsSource = (source === 'game') ? 'game' : 'discord';
        this.currentNewsFeed = this.currentNewsSource;
        this.searchQuery = '';
        this.currentCategory = 'all';

        const activeList = this.getActiveArticles();
        if (activeList && activeList.length > 0) {
            this.currentArticleId = activeList[0].id;
        } else {
            this.currentArticleId = null;
        }

        this.renderNewsSection();
    }

    setNewsFeed(feed) {
        this.activeArticleView = null;
        this.currentNewsFeed = ['all', 'game', 'discord'].includes(feed) ? feed : 'all';
        this.currentNewsSource = this.currentNewsFeed === 'discord' ? 'discord' : 'game';
        this.currentCategory = 'all';
        this.featuredNewsIndex = 0;
        this.renderNewsSection();
        this.restoreNewsFilterPopover();
    }

    ensureFeaturedNewsRotation() {
        if (this.featuredRotationTimer) return;

        this.featuredRotationTimer = window.setInterval(() => {
            const newsSection = document.getElementById('hubNewsSection');
            const featuredCard = newsSection?.querySelector('.sba-news-featured-card');
            if (!featuredCard || newsSection.style.display === 'none' || document.hidden || this.featuredRotationIsTransitioning) return;

            this.featuredRotationIsTransitioning = true;
            featuredCard.classList.add('is-rotating-out');

            window.setTimeout(() => {
                this.featuredNewsIndex += 1;
                this.featuredShouldFadeIn = true;
                this.renderNewsSection();
                this.featuredShouldFadeIn = false;
                this.featuredRotationIsTransitioning = false;
            }, 260);
        }, 10000);
    }

    /**
     * Populates the Top-Left News Widget on Home View (#hubHomeSection)
     * with an interactive 10-second rotating carousel between:
     * - Slide 1: Original Dokkan Battle & Custom Releases Box / Discord Announcements
     * - Slide 2: Dokkan Live News Releases (Horizontal Mini-Timeline)
    * Hovering pauses the 10-second auto-scroll timer.
     */
    renderHomeSnippet() {
        const snippetEls = Array.from(document.querySelectorAll('.dokkan-news-snippet'));
        const snippetEl = snippetEls[0];
        if (!snippetEl) return;

        const formatDate = (ds) => {
            if (!ds) return 'Recent';
            const cleanStr = ds.split(' ')[0];
            const p = cleanStr.split(/[-/]/);
            if (p.length === 3) {
                let m, d;
                if (p[0].length === 4) { m = parseInt(p[1]); d = parseInt(p[2]); }
                else { m = parseInt(p[0]); d = parseInt(p[1]); }
                const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                const month = months[m-1] || m;
                let suffix = 'th';
                if (d % 10 === 1 && d !== 11) suffix = 'st';
                else if (d % 10 === 2 && d !== 12) suffix = 'nd';
                else if (d % 10 === 3 && d !== 13) suffix = 'rd';
                return `${month} ${d}${suffix}`;
            }
            return cleanStr;
        };

        const getArticleTimestamp = (art) => {
            if (!art) return 0;
            if (art.start_at) return art.start_at * 1000;
            if (art.timestamp) {
                const t = new Date(art.timestamp).getTime();
                if (!isNaN(t)) return t;
            }
            if (art.date_added) {
                const cleanStr = art.date_added.replace(' ', 'T');
                const t = new Date(cleanStr).getTime();
                if (!isNaN(t)) return t;
                const d = new Date(art.date_added).getTime();
                if (!isNaN(d)) return d;
            }
            return 0;
        };

        // Top 5 most recent articles (e.g. from 26th to 21st)
        const top5Articles = this.articles.slice(0, 5);
        const latestDate = top5Articles.length > 0 ? formatDate(top5Articles[0].date_added) : 'Recent';
        
        // Triple top 5 articles for a seamless continuous scroll loop
        const displayArticles = [...top5Articles, ...top5Articles, ...top5Articles];

        // SBA Home uses the same current news data as a compact ticker instead
        // of the large dashboard card. The dedicated News view is unchanged.
        if (document.body.classList.contains('theme-sba')) {
            const tickerItemsHtml = displayArticles.map((art) => {
                const imgUrl = normalizeDokkanNewsUrl(art.banner)
                    || (art.bodies && art.bodies.find(seg => seg.image)?.image)
                    || (art.banner && art.banner !== DOKKAN_NO_NEWS_IMG ? art.banner : null)
                    || DOKKAN_NO_NEWS_IMG;
                return `
                    <button type="button" class="sba-news-ticker-item" onclick="openDokkanNewsArticle(${art.id})" title="${art.title}">
                        <span class="sba-news-ticker-thumb"><img src="${imgUrl}" alt="" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';"></span>
                        <span class="sba-news-ticker-copy">
                            <span class="sba-news-ticker-date">${formatDate(art.date_added)}</span>
                            <span class="sba-news-ticker-title">${art.title}</span>
                        </span>
                    </button>`;
                }).join('');

            snippetEl.innerHTML = `
                <button type="button" class="sba-news-ticker-brand" onclick="switchHubView('news')" aria-label="Open News">
                    <img class="sba-news-ticker-logo" src="https://abscustom.github.io/assets/images/abs_logo.png" alt="">
                    <span>NEWS</span>
                </button>
                <div class="sba-news-ticker-viewport">
                    <div class="sba-news-ticker-track" id="sbaNewsTickerTrack">${tickerItemsHtml}</div>
                </div>`;

            // Keep the Cards copy in sync with Home while giving its track a
            // unique id. Both instances use the same live article data and
            // retain the ticker's smooth horizontal scrolling behavior.
            snippetEls.slice(1).forEach((target, index) => {
                target.innerHTML = snippetEl.innerHTML.replace(
                    /id="sbaNewsTickerTrack"/g,
                    `id="sbaNewsTickerTrack-${index + 1}"`
                );
            });

            snippetEls.forEach((target) => {
                const ticker = target.querySelector('.sba-news-ticker-track');
                if (!ticker) return;
                ticker.dataset.setLength = String(top5Articles.length);
                const attachTicker = () => {
                    const items = ticker.querySelectorAll('.sba-news-ticker-item');
                    if (items.length >= top5Articles.length * 2 && items[top5Articles.length]) {
                        const first = items[0].getBoundingClientRect();
                        const repeat = items[top5Articles.length].getBoundingClientRect();
                        const distance = Math.round(repeat.left - first.left);
                        if (distance > 50) ticker.dataset.singleSetWidth = String(distance);
                    }
                    if (window.attachSmoothHorizontalScroll) window.attachSmoothHorizontalScroll(ticker, 0.30);
                    else setTimeout(attachTicker, 80);
                };
                setTimeout(attachTicker, 60);
            });
            return;
        }
        
        const cardsHtml = displayArticles.map((art, idx) => {
            const catBadge = this.getCategoryBadge(art.category);
            let imgUrl = normalizeDokkanNewsUrl(art.banner)
                || (art.bodies && art.bodies.find(seg => seg.image)?.image)
                || (art.banner && art.banner !== DOKKAN_NO_NEWS_IMG ? art.banner : null)
                || DOKKAN_NO_NEWS_IMG;

            return `
                <div class="news-timeline-card mini-card" onclick="openDokkanNewsArticle(${art.id})">
                    <div class="news-timeline-card-img-wrap mini-wrap">
                        <img src="${imgUrl}" alt="${art.title}" class="news-timeline-card-img" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                    </div>
                    <div class="news-timeline-card-body mini-body">
                        <div class="mini-card-meta">
                            ${catBadge}
                            <span class="mini-card-date">${formatDate(art.date_added)}</span>
                        </div>
                        <h4 class="news-timeline-card-title mini-title" title="${art.title}">${art.title}</h4>
                    </div>
                </div>
            `;
        }).join('');

        snippetEl.innerHTML = `
            <div class="news-snippet-badge">${newsSvgIcon('news')} DOKKAN NEWS & CAMPAIGNS</div>
            
            <div class="news-mini-timeline-strip-container">
                <div class="news-mini-timeline-track" id="newsMiniTimelineTrack">
                    ${cardsHtml}
                </div>
            </div>

            <div class="news-snippet-content">
                <div class="news-snippet-header">
                    <span class="news-tag">LATEST EVENT</span>
                    <span class="news-date">${latestDate}</span>
                </div>
                <h3 class="news-title">Dokkan Battle & Custom Releases</h3>
                <p class="news-desc">Explore the chronological data download releases, newly awakened Extreme Z-Awakenings, Super EZAs, and custom cards in the scrollable timeline.</p>
                <div class="news-quick-links">
                    <button type="button" class="news-link-btn" onclick="switchHubView('news')">
                        <span>Official News Feed ${newsSvgIcon('external')}</span>
                    </button>
                </div>
            </div>
        `;

        const track = document.getElementById('newsMiniTimelineTrack');
        if (track) {
            track.dataset.setLength = "5";
            const tryAttach = () => {
                const cards = track.querySelectorAll('.mini-card');
                if (cards.length >= 10 && cards[5]) {
                    const r0 = cards[0].getBoundingClientRect();
                    const r5 = cards[5].getBoundingClientRect();
                    const dist = Math.round(r5.left - r0.left);
                    if (dist > 50) track.dataset.singleSetWidth = String(dist);
                }
                if (window.attachSmoothHorizontalScroll) {
                    window.attachSmoothHorizontalScroll(track, 0.22);
                } else {
                    setTimeout(tryAttach, 80);
                }
            };
            setTimeout(tryAttach, 60);
            setTimeout(tryAttach, 300);
        }
    }

    /**
     * Interactive High-Resolution Image & Video Lightbox Expand Viewer with Carousel Navigation
     */
    initLightboxModal() {
        let modal = document.getElementById('dokkan-image-lightbox-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dokkan-image-lightbox-modal';
            modal.className = 'dokkan-lightbox-backdrop';
            modal.innerHTML = `
                <div class="dokkan-lightbox-container">
                    <div class="dokkan-lightbox-header">
                        <div class="dokkan-lightbox-meta">
                            <span class="dokkan-lightbox-tag" id="lightboxTag">${newsSvgIcon('image')} PREVIEW</span>
                            <span class="dokkan-lightbox-counter-pill" id="lightboxCounter">1 / 1</span>
                            <span class="dokkan-lightbox-date" id="lightboxDate"></span>
                            <span class="dokkan-lightbox-title" id="lightboxTitle"></span>
                        </div>
                        <button type="button" class="dokkan-lightbox-close-btn" onclick="window.dokkanNews.closeLightbox()" title="Close (Esc)">✕</button>
                    </div>
                    <div class="dokkan-lightbox-body" id="lightboxBody">
                        <button type="button" class="dokkan-lightbox-nav-btn prev" id="lightboxPrevBtn" onclick="window.dokkanNews.prevGalleryItem()" title="Previous">${newsSvgIcon('previous')}</button>
                        
                        <div class="dokkan-lightbox-media-viewport">
                            <img id="lightboxImg" src="" alt="Expanded View" class="dokkan-lightbox-img" style="display: none;">
                            <video id="lightboxVideo" src="" controls autoplay playsinline class="dokkan-lightbox-video" style="display: none;"></video>
                        </div>
                        
                        <button type="button" class="dokkan-lightbox-nav-btn next" id="lightboxNextBtn" onclick="window.dokkanNews.nextGalleryItem()" title="Next">${newsSvgIcon('next')}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeLightbox();
                }
            });

            document.addEventListener('keydown', (e) => {
                const m = document.getElementById('dokkan-image-lightbox-modal');
                if (m && m.classList.contains('active')) {
                    if (e.key === 'Escape') {
                        this.closeLightbox();
                    } else if (e.key === 'ArrowLeft') {
                        this.prevGalleryItem();
                    } else if (e.key === 'ArrowRight') {
                        this.nextGalleryItem();
                    }
                }
            });
        }
        return modal;
    }

    openGalleryIndex(idx) {
        if (!this.campaignGallery || this.campaignGallery.length === 0) return;
        if (idx < 0) idx = this.campaignGallery.length - 1;
        if (idx >= this.campaignGallery.length) idx = 0;
        this.currentGalleryIndex = idx;

        const item = this.campaignGallery[idx];
        if (!item) return;

        this.renderLightboxContent(item.url, item.title, item.date, item.type, idx, this.campaignGallery.length);
    }

    prevGalleryItem() {
        if (!this.campaignGallery || this.campaignGallery.length <= 1) return;
        this.openGalleryIndex(this.currentGalleryIndex - 1);
    }

    nextGalleryItem() {
        if (!this.campaignGallery || this.campaignGallery.length <= 1) return;
        this.openGalleryIndex(this.currentGalleryIndex + 1);
    }

    renderLightboxContent(mediaUrl, title = '', date = '', type = 'image', index = 0, total = 1) {
        const modal = this.initLightboxModal();
        const isVideo = (type === 'video') || /\.(mp4|webm|mov|m4v)$/i.test(mediaUrl);

        const tagEl = document.getElementById('lightboxTag');
        const counterEl = document.getElementById('lightboxCounter');
        const imgEl = document.getElementById('lightboxImg');
        const vidEl = document.getElementById('lightboxVideo');
        const titleEl = document.getElementById('lightboxTitle');
        const dateEl = document.getElementById('lightboxDate');
        const prevBtn = document.getElementById('lightboxPrevBtn');
        const nextBtn = document.getElementById('lightboxNextBtn');

        if (tagEl) tagEl.innerHTML = `${newsSvgIcon(isVideo ? 'video' : 'image')} ${isVideo ? 'VIDEO' : 'IMAGE'}`;
        if (counterEl) {
            counterEl.textContent = total > 1 ? `${index + 1} / ${total}` : '';
            counterEl.style.display = total > 1 ? 'inline-block' : 'none';
        }
        if (prevBtn) prevBtn.style.display = total > 1 ? 'flex' : 'none';
        if (nextBtn) nextBtn.style.display = total > 1 ? 'flex' : 'none';

        if (titleEl) titleEl.textContent = title || (isVideo ? 'Campaign Video' : 'Dokkan Visual');
        if (dateEl) dateEl.textContent = date ? `• ${date}` : '';

        if (isVideo) {
            if (imgEl) imgEl.style.display = 'none';
            if (vidEl) {
                vidEl.pause();
                vidEl.volume = 0.10; // Default volume set to 10% for comfortable listening
                vidEl.src = mediaUrl;
                vidEl.style.display = 'block';
                vidEl.load();
                vidEl.play().catch(() => {});
            }
        } else {
            if (vidEl) {
                vidEl.pause();
                vidEl.src = '';
                vidEl.style.display = 'none';
            }
            if (imgEl) {
                imgEl.src = mediaUrl;
                imgEl.style.display = 'block';
            }
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    expandMedia(mediaUrl, title = '', date = '', type = 'image') {
        this.campaignGallery = [{ url: mediaUrl, title, date, type }];
        this.currentGalleryIndex = 0;
        this.renderLightboxContent(mediaUrl, title, date, type, 0, 1);
    }

    expandImage(imgUrl, title = '', date = '') {
        this.expandMedia(imgUrl, title, date, 'image');
    }

    closeLightbox() {
        const modal = document.getElementById('dokkan-image-lightbox-modal');
        if (modal) {
            const vidEl = document.getElementById('lightboxVideo');
            if (vidEl) {
                vidEl.pause();
                vidEl.src = '';
            }
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * FULLSCREEN ENLARGED ARTICLE MODAL SYSTEM
     * Opens a large, focused, scrollable card overlay of the entire news announcement
     */
    initEnlargedArticleModal() {
        let modal = document.getElementById('dokkan-enlarged-article-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'dokkan-enlarged-article-modal';
            modal.className = 'enlarged-article-modal';
            modal.innerHTML = `
                <div class="enlarged-article-backdrop" onclick="window.dokkanNews.closeEnlargedArticle()"></div>
                <div class="enlarged-article-card" id="enlargedArticleCard">
                    <!-- Top Action / Navigation Bar -->
                    <div class="enlarged-card-header">
                        <div class="enlarged-header-left">
                            <button type="button" class="enlarged-nav-btn" id="enlargedPrevBtn" onclick="window.dokkanNews.prevEnlargedArticle()">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                <span>Previous</span>
                            </button>
                            <span class="enlarged-counter" id="enlargedCounter"></span>
                            <button type="button" class="enlarged-nav-btn" id="enlargedNextBtn" onclick="window.dokkanNews.nextEnlargedArticle()">
                                <span>Next</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            </button>
                        </div>
                        <div class="enlarged-header-right">
                            <span class="enlarged-badge" id="enlargedBadge"></span>
                            <button type="button" class="enlarged-close-btn" onclick="window.dokkanNews.closeEnlargedArticle()" title="Close Enlarger (Esc)">✕</button>
                        </div>
                    </div>

                    <!-- Scrollable Full Article Body -->
                    <div class="enlarged-card-body" id="enlargedCardBody"></div>
                </div>
            `;
            document.body.appendChild(modal);

            document.addEventListener('keydown', (e) => {
                const m = document.getElementById('dokkan-enlarged-article-modal');
                if (m && m.classList.contains('active')) {
                    if (e.key === 'Escape') {
                        this.closeEnlargedArticle();
                    } else if (e.key === 'ArrowLeft') {
                        this.prevEnlargedArticle();
                    } else if (e.key === 'ArrowRight') {
                        this.nextEnlargedArticle();
                    }
                }
            });
        }
        return modal;
    }

    handleImageZoomMove(e, wrapEl) {
        if (!wrapEl || !wrapEl.classList.contains('is-magnified')) return;
        const img = wrapEl.querySelector('img');
        if (!img) return;

        const rect = wrapEl.getBoundingClientRect();
        const xPercent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const yPercent = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const imgWidth = img.offsetWidth || (rect.width * 2.8);
        const imgHeight = img.offsetHeight || (rect.height * 2.8);
        const maxScrollX = Math.max(0, imgWidth - rect.width);
        const maxScrollY = Math.max(0, imgHeight - rect.height);

        const moveX = -(xPercent * maxScrollX);
        const moveY = -(yPercent * maxScrollY);

        img.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0)`;
    }

    toggleImageZoom(e, wrapEl) {
        if (!wrapEl) return;
        const img = wrapEl.querySelector('img');
        if (!img) return;

        const isCurrentlyMagnified = wrapEl.classList.contains('is-magnified');
        if (isCurrentlyMagnified) {
            // Unmagnify / Reset zoom back to responsive fit
            wrapEl.classList.remove('is-magnified');
            img.style.transform = '';
            img.style.width = '';
            img.style.height = '';
            img.style.maxWidth = '';
            img.style.maxHeight = '';
            img.style.position = '';
            img.style.left = '';
            img.style.top = '';
            const badge = wrapEl.querySelector('.glass-zoom-pill');
            if (badge) {
                badge.classList.remove('active');
                badge.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                `;
            }
        } else {
            // Magnify with crystal clear native resolution
            wrapEl.classList.add('is-magnified');
            const rect = wrapEl.getBoundingClientRect();
            
            // Calculate optimal target magnification (2.8x of box width for razor sharp small text)
            const targetWidth = Math.max(rect.width * 2.8, 1600);
            
            img.style.width = `${targetWidth}px`;
            img.style.maxWidth = 'none';
            img.style.maxHeight = 'none';
            img.style.height = 'auto';
            img.style.position = 'absolute';
            img.style.left = '0';
            img.style.top = '0';

            const xPercent = (e && e.clientX !== undefined) 
                ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) 
                : 0.5;
            const yPercent = (e && e.clientY !== undefined) 
                ? Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) 
                : 0.5;

            requestAnimationFrame(() => {
                const imgWidth = img.offsetWidth || targetWidth;
                const imgHeight = img.offsetHeight || (targetWidth * 1.4);
                const maxScrollX = Math.max(0, imgWidth - rect.width);
                const maxScrollY = Math.max(0, imgHeight - rect.height);
                const moveX = -(xPercent * maxScrollX);
                const moveY = -(yPercent * maxScrollY);
                img.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0)`;
            });

            const badge = wrapEl.querySelector('.glass-zoom-pill');
            if (badge) {
                badge.classList.add('active');
                badge.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                `;
            }
        }
    }

    renderArticleBodyHtml(article) {
        const catBadge = this.getCategoryBadge(article.category);
        const heroBanner = normalizeDokkanNewsUrl(article.banner)
            || (article.bodies || []).find(segment => segment.image)?.image
            || DOKKAN_NO_NEWS_IMG;

        let bodySegmentsHtml = '';
        if (article.isDiscord) {
            const videos = (article.media || []).filter(media => media.type === 'video');
            const images = (article.media || [])
                .filter(media => media.type === 'image')
                .sort((a, b) => (a.visualNumber || 0) - (b.visualNumber || 0));
            const textBodies = (article.bodies || []).filter(body => body.description && !body.image && !body.video);

            const textsHtml = textBodies.map(body => `
                <div class="news-body-segment">
                    <div class="news-segment-text">${this.parseDokkanMarkup(body.description)}</div>
                </div>
            `).join('');

            const videosHtml = videos.map((video, index) => `
                <div class="discord-full-visual-card">
                    <div class="discord-visual-tag-bar"><span class="discord-visual-tag">${newsSvgIcon('video')} Video ${index + 1}</span></div>
                    <div class="news-segment-video-wrap sba-news-reader-video">
                        <video src="${escapeNewsHtml(video.url)}" controls playsinline preload="metadata" onloadedmetadata="this.volume=0.10"></video>
                    </div>
                </div>
            `).join('');

            const imagesHtml = images.map((image, index) => {
                const visualLabel = `Visual ${image.visualNumber || index + 1}`;
                return `
                    <div class="discord-full-visual-card">
                        <div class="discord-visual-tag-bar"><span class="discord-visual-tag">${newsSvgIcon('image')} ${visualLabel}</span></div>
                        <div class="discord-full-visual-img-wrap"
                             onclick="window.dokkanNews.toggleImageZoom(event, this)"
                             onmousemove="window.dokkanNews.handleImageZoomMove(event, this)"
                             title="Click to magnify small text / Pan around">
                            <img src="${escapeNewsHtml(image.url)}" alt="${escapeNewsHtml(visualLabel)}" class="discord-full-visual-img" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                            <div class="glass-zoom-pill" title="Click to Magnify / Reset">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    <line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>
                                </svg>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            bodySegmentsHtml = `${textsHtml}${videosHtml}${imagesHtml}`;
        } else if (article.bodies && article.bodies.length > 0) {
            bodySegmentsHtml = article.bodies.map((body, index) => `
                <div class="news-body-segment">
                    ${body.video ? `
                        <div class="news-segment-video-wrap sba-news-reader-video">
                            <video src="${escapeNewsHtml(body.video)}" controls playsinline preload="metadata" onloadedmetadata="this.volume=0.10"></video>
                        </div>
                    ` : ''}
                    ${body.image ? `
                        <div class="news-segment-img-wrap"
                             onclick="window.dokkanNews.toggleImageZoom(event, this)"
                             onmousemove="window.dokkanNews.handleImageZoomMove(event, this)"
                             title="Click to magnify small text / Pan around">
                            <img src="${escapeNewsHtml(body.image)}" alt="Segment Image ${index + 1}" class="news-segment-img" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                            <div class="glass-zoom-pill" title="Click to Magnify / Reset">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    <line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>
                                </svg>
                            </div>
                        </div>
                    ` : ''}
                    ${body.description ? `<div class="news-segment-text">${this.parseDokkanMarkup(body.description)}</div>` : ''}
                </div>
            `).join('');
        }

        if (!bodySegmentsHtml) {
            bodySegmentsHtml = `<div class="news-body-segment"><p>${article.isDiscord ? 'No visual or text details provided for this release batch.' : 'No details provided for this notice.'}</p></div>`;
        }

        const showHeroBanner = heroBanner && heroBanner !== DOKKAN_NO_NEWS_IMG;
        return `
            ${showHeroBanner ? `
                <div class="enlarged-hero-banner-wrap sba-news-reader-hero">
                    <img src="${escapeNewsHtml(heroBanner)}" alt="Announcement Banner" class="enlarged-hero-img" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                </div>
            ` : ''}
            <header class="news-reader-header sba-news-reader-heading">
                <div class="reader-header-meta sba-news-reader-meta">
                    ${catBadge}
                    <span class="reader-header-date">Added: ${escapeNewsHtml(article.date_added || 'Recent')}</span>
                </div>
                <h1 id="sbaNewsReaderTitle" class="reader-header-title">${escapeNewsHtml(article.title || 'Dokkan Announcement')}</h1>
            </header>
            <div class="news-reader-segments-stream sba-news-reader-stream">
                ${bodySegmentsHtml}
            </div>
        `;
    }

    openEnlargedArticle(articleId, source = null) {
        if (source) {
            this.currentNewsSource = source;
        }

        let list = this.getEnlargedArticleList();
        if (!list || list.length === 0) return;

        let article = null;
        if (articleId !== undefined && articleId !== null) {
            // Match by string/number comparison
            article = list.find(a => String(a.id) === String(articleId));

            // If not found in the selected list, check the other list
            if (!article) {
                if (this.currentNewsSource === 'discord') {
                    article = this.articles.find(a => String(a.id) === String(articleId));
                    if (article) {
                        this.currentNewsSource = 'game';
                        list = this.getEnlargedArticleList();
                    }
                } else {
                    article = this.discordBatches.find(a => String(a.id) === String(articleId));
                    if (article) {
                        this.currentNewsSource = 'discord';
                        list = this.getEnlargedArticleList();
                    }
                }
            }
        }

        if (!article) article = list[0];
        if (!article) return;

        this.currentArticleId = article.id;
        const currentIndex = list.findIndex(a => String(a.id) === String(article.id));

        this.activeArticleView = {
            id: article.id,
            source: this.currentNewsSource
        };

        const newsSection = document.getElementById('hubNewsSection');
        if (!newsSection || newsSection.style.display === 'none') {
            if (typeof switchHubView === 'function') {
                switchHubView('news');
            } else {
                this.renderNewsSection();
            }
        } else {
            this.renderNewsSection();
        }

        try {
            const url = new URL(window.location.href);
            url.searchParams.set('view', 'news');
            url.searchParams.set('source', this.currentNewsSource);
            url.searchParams.set('article', String(article.id));
            window.history.replaceState({}, document.title, url.pathname + url.search);
        } catch (e) {}

        return;

        const modal = this.initEnlargedArticleModal();
        const counterEl = document.getElementById('enlargedCounter');
        const badgeEl = document.getElementById('enlargedBadge');
        const prevBtn = document.getElementById('enlargedPrevBtn');
        const nextBtn = document.getElementById('enlargedNextBtn');
        const bodyContainer = document.getElementById('enlargedCardBody');

        if (counterEl) {
            counterEl.textContent = `${this.currentNewsSource === 'discord' ? 'Batch' : 'Notice'} ${currentIndex + 1} of ${list.length}`;
        }
        if (badgeEl) {
            badgeEl.innerHTML = article.isDiscord ? (article.mediaCount ? `${article.mediaCount} Visuals` : 'Discord') : `ID: ${article.id}`;
        }
        if (prevBtn) prevBtn.disabled = (currentIndex === 0);
        if (nextBtn) nextBtn.disabled = (currentIndex === list.length - 1);

        if (bodyContainer) {
            const catBadge = this.getCategoryBadge(article.category);
            const heroBanner = article.banner || (article.bodies && article.bodies.find(s => s.image)?.image) || DOKKAN_NO_NEWS_IMG;

            let bodySegmentsHtml = '';
            if (article.isDiscord) {
                const videos = (article.media || []).filter(m => m.type === 'video');
                const images = (article.media || []).filter(m => m.type === 'image').sort((a, b) => (a.visualNumber || 0) - (b.visualNumber || 0));
                const textBodies = (article.bodies || []).filter(b => b.description && !b.image && !b.video);

                let textsHtml = '';
                if (textBodies.length > 0) {
                    textsHtml = textBodies.map(t => `
                        <div class="news-body-segment">
                            <div class="news-segment-text">
                                ${this.parseDokkanMarkup(t.description)}
                            </div>
                        </div>
                    `).join('');
                }

                let videosHtml = '';
                if (videos.length > 0) {
                    videosHtml = videos.map((v, vIdx) => `
                        <div class="discord-full-visual-card">
                            <div class="discord-visual-tag-bar">
                                <span class="discord-visual-tag">${newsSvgIcon('video')} Video ${vIdx + 1}</span>
                            </div>
                            <div class="news-segment-video-wrap" style="margin: 0 auto; border-radius: 10px; overflow: hidden; background: #000; border: 1.5px solid rgba(129, 140, 248, 0.4); width: 100%;">
                                <video src="${v.url}" controls playsinline preload="metadata" onloadedmetadata="this.volume=0.10" style="width: 100%; max-height: 480px; display: block;"></video>
                            </div>
                        </div>
                    `).join('');
                }

                let imagesHtml = '';
                if (images.length > 0) {
                    imagesHtml = images.map((img, imgIdx) => {
                        const visualLabel = `Visual ${img.visualNumber || (imgIdx + 1)}`;
                        return `
                            <div class="discord-full-visual-card">
                                <div class="discord-visual-tag-bar">
                                    <span class="discord-visual-tag">${newsSvgIcon('image')} ${visualLabel}</span>
                                </div>
                                <div class="discord-full-visual-img-wrap" 
                                     onclick="window.dokkanNews.toggleImageZoom(event, this)" 
                                     onmousemove="window.dokkanNews.handleImageZoomMove(event, this)"
                                     title="Click to magnify small text / Pan around">
                                    <img src="${img.url}" alt="${visualLabel}" class="discord-full-visual-img" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                                    <div class="glass-zoom-pill" title="Click to Magnify / Reset">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                            <line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                }

                bodySegmentsHtml = `${textsHtml}${videosHtml}${imagesHtml}`;
                if (!bodySegmentsHtml) {
                    bodySegmentsHtml = `<div class="news-body-segment"><p>No visual or text details provided for this release batch.</p></div>`;
                }
            } else if (article.bodies && article.bodies.length > 0) {
                bodySegmentsHtml = article.bodies.map((body, idx) => `
                    <div class="news-body-segment">
                        ${body.video ? `
                            <div class="news-segment-video-wrap" style="margin: 10px auto; border-radius: 10px; overflow: hidden; background: #000; border: 1.5px solid rgba(56, 189, 248, 0.3);">
                                <video src="${body.video}" controls playsinline preload="metadata" onloadedmetadata="this.volume=0.10" style="width: 100%; max-height: 480px; display: block;"></video>
                            </div>
                        ` : ''}
                        ${body.image ? `
                            <div class="news-segment-img-wrap" 
                                 onclick="window.dokkanNews.toggleImageZoom(event, this)" 
                                 onmousemove="window.dokkanNews.handleImageZoomMove(event, this)"
                                 title="Click to magnify small text / Pan around">
                                <img src="${body.image}" alt="Segment Image ${idx + 1}" class="news-segment-img" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                                <div class="glass-zoom-pill" title="Click to Magnify / Reset">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                        <line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line>
                                    </svg>
                                </div>
                            </div>
                        ` : ''}
                        ${body.description ? `
                            <div class="news-segment-text">
                                ${this.parseDokkanMarkup(body.description)}
                            </div>
                        ` : ''}
                    </div>
                `).join('');
            } else {
                bodySegmentsHtml = `<div class="news-body-segment"><p>No details provided for this notice.</p></div>`;
            }

            const showHeroBanner = !article.isDiscord && (heroBanner && heroBanner !== DOKKAN_NO_NEWS_IMG);

            bodyContainer.innerHTML = `
                ${showHeroBanner ? `
                    <div class="enlarged-hero-banner-wrap">
                        <img src="${heroBanner}" alt="Announcement Banner" class="enlarged-hero-img" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                    </div>
                ` : ''}

                <div class="news-reader-header" style="text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; margin-bottom: 24px;">
                    <div class="reader-header-meta" style="justify-content: center; margin-bottom: 10px;">
                        ${catBadge}
                        <span class="reader-header-date">Added: ${article.date_added}</span>
                    </div>
                    <h1 class="reader-header-title" style="font-size: 26px;">${article.title}</h1>
                </div>

                <div class="news-reader-segments-stream">
                    ${bodySegmentsHtml}
                </div>
            `;
            bodyContainer.scrollTop = 0;
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeEnlargedArticle() {
        this.activeArticleView = null;
        const modal = document.getElementById('dokkan-enlarged-article-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }

        const newsSection = document.getElementById('hubNewsSection');
        if (newsSection && newsSection.style.display !== 'none') {
            this.renderNewsSection();
        }

        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('article');
            url.searchParams.delete('source');
            if (url.searchParams.get('view') === 'news') {
                window.history.replaceState({}, document.title, url.pathname + url.search);
            }
        } catch (e) {}
    }

    prevEnlargedArticle() {
        const list = this.getEnlargedArticleList();
        const idx = list.findIndex(a => String(a.id) === String(this.currentArticleId));
        if (idx > 0) {
            this.openEnlargedArticle(list[idx - 1].id, this.currentNewsSource);
        }
    }

    nextEnlargedArticle() {
        const list = this.getEnlargedArticleList();
        const idx = list.findIndex(a => String(a.id) === String(this.currentArticleId));
        if (idx !== -1 && idx < list.length - 1) {
            this.openEnlargedArticle(list[idx + 1].id, this.currentNewsSource);
        }
    }

    getEnlargedArticleList() {
        // The reader follows the same source, category, search, and release
        // date ordering as the visible newsroom grid.
        return this.getNewsDashboardItems(this.currentNewsSource);
    }

    getNewsDashboardItems(source) {
        const isDiscord = source === 'discord';
        const list = isDiscord ? this.discordBatches : this.articles;
        const query = this.searchQuery.trim().toLowerCase();

        const filteredItems = [...(list || [])].filter(item => {
            const matchesCategory = this.currentCategory === 'all' || (!isDiscord && item.category === this.currentCategory);
            if (!matchesCategory) return false;
            if (!query) return true;

            const searchable = [
                item.title,
                item.date_added,
                item.date,
                ...(item.bodies || []).map(body => body.description || '')
            ].join(' ').toLowerCase();
            return searchable.includes(query);
        });

        return this.sortNewsDashboardItems(filteredItems);
    }

    getCampaignShowcaseItems() {
        // This display is deliberately kept to actual playable campaign/event
        // announcements. Character previews, maintenance, and issue notices
        // remain available in their source lists, but never enter the rotator.
        return [...(this.articles || [])].filter(item => ['campaign', 'event'].includes(item.category));
    }

    getNewsDashboardImage(item) {
        return normalizeDokkanNewsUrl(item?.banner)
            || (item?.bodies || []).find(body => body.image)?.image
            || DOKKAN_NO_NEWS_IMG;
    }

    getNewsDashboardExcerpt(item) {
        const body = item?.summary
            || (item?.bodies || []).find(entry => entry.description)?.description
            || '';
        const cleaned = String(body)
            .replace(/\{[^{}]+\}/g, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned || 'Open this update to view the full notice and attached campaign details.';
    }

    getNewsDashboardDate(item) {
        const rawDate = item?.date_added || item?.date || 'Recent';
        const date = new Date(String(rawDate).replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return String(rawDate);
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    }

    getNewsDashboardTimestamp(item) {
        if (Number.isFinite(Number(item?.start_at)) && Number(item.start_at) > 0) {
            return Number(item.start_at) * 1000;
        }

        const rawDate = item?.timestamp || item?.date_added || item?.date || '';
        const parsed = new Date(String(rawDate).replace(' ', 'T')).getTime();
        return Number.isFinite(parsed) ? parsed : 0;
    }

    sortNewsDashboardItems(items) {
        const direction = this.newsSortOrder === 'oldest' ? 1 : -1;
        return [...(items || [])].sort((a, b) => {
            const timestampDifference = this.getNewsDashboardTimestamp(a) - this.getNewsDashboardTimestamp(b);
            if (timestampDifference !== 0) return timestampDifference * direction;

            const aId = String(a?.id ?? '');
            const bId = String(b?.id ?? '');
            return aId.localeCompare(bId, undefined, { numeric: true }) * direction;
        });
    }

    getNewsDashboardType(item, source) {
        if (source === 'discord') return 'COMMUNITY RELEASE';
        return String(item?.category || 'news').toUpperCase();
    }

    renderNewsDashboardRow(item, source) {
        const image = escapeNewsHtml(this.getNewsDashboardImage(item));
        const title = escapeNewsHtml(item?.title || 'Dokkan Announcement');
        const excerpt = escapeNewsHtml(this.getNewsDashboardExcerpt(item));
        const date = escapeNewsHtml(this.getNewsDashboardDate(item));
        const type = escapeNewsHtml(this.getNewsDashboardType(item, source));
        const id = escapeNewsHtml(item?.id);

        return `
            <li>
                <button type="button" class="sba-news-list-row" data-news-open data-news-source="${source}" data-news-id="${id}">
                    <span class="sba-news-list-copy">
                        <span class="sba-news-list-meta">${type}<span aria-hidden="true">•</span>${date}</span>
                        <strong>${title}</strong>
                        <span class="sba-news-list-excerpt">${excerpt}</span>
                    </span>
                    <span class="sba-news-list-image"><img src="${image}" alt="" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('is-fallback')"></span>
                </button>
            </li>`;
    }

    renderNewsCompactRow(item, source) {
        const title = escapeNewsHtml(item?.title || 'Dokkan Announcement');
        const date = escapeNewsHtml(this.getNewsDashboardDate(item));
        const type = escapeNewsHtml(this.getNewsDashboardType(item, source));
        const id = escapeNewsHtml(item?.id);
        const image = escapeNewsHtml(this.getNewsDashboardImage(item));
        const discordPreview = source === 'discord' ? `<span class="sba-news-compact-image"><img src="${image}" alt="" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('is-fallback')"></span>` : '';

        return `
            <li>
                <button type="button" class="sba-news-compact-row${source === 'discord' ? ' has-preview' : ''}" data-news-open data-news-source="${source}" data-news-id="${id}">
                    <span class="sba-news-compact-copy"><span class="sba-news-compact-meta">${type}<span aria-hidden="true">•</span>${date}</span><strong>${title}</strong></span>
                    ${discordPreview}
                </button>
            </li>`;
    }

    renderNewsEditorialCard(item, source) {
        const image = escapeNewsHtml(this.getNewsDashboardImage(item));
        const title = escapeNewsHtml(item?.title || 'Dokkan Announcement');
        const excerpt = escapeNewsHtml(this.getNewsDashboardExcerpt(item));
        const date = escapeNewsHtml(this.getNewsDashboardDate(item));
        const type = escapeNewsHtml(this.getNewsDashboardType(item, source));
        const id = escapeNewsHtml(item?.id);

        return `
            <button type="button" class="sba-news-editorial-card" data-news-open data-news-source="${source}" data-news-id="${id}">
                <span class="sba-news-editorial-image"><img src="${image}" alt="" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('is-fallback')"></span>
                <span class="sba-news-editorial-copy">
                    <span class="sba-news-editorial-meta">${type}<span aria-hidden="true">•</span>${date}</span>
                    <strong>${title}</strong>
                    <span class="sba-news-editorial-excerpt">${excerpt}</span>
                </span>
            </button>`;
    }

    renderNewsGridCard(item, source) {
        const image = escapeNewsHtml(this.getNewsDashboardImage(item));
        const title = escapeNewsHtml(item?.title || 'Dokkan Announcement');
        const excerpt = escapeNewsHtml(this.getNewsDashboardExcerpt(item));
        const date = escapeNewsHtml(this.getNewsDashboardDate(item));
        const type = escapeNewsHtml(source === 'discord' ? 'DISCORD' : String(item?.category || 'NEWS').toUpperCase());
        const id = escapeNewsHtml(item?.id);
        const category = escapeNewsHtml(source === 'discord' ? 'discord' : (item?.category || 'general'));

        return `
            <button type="button" class="sba-news-grid-card" data-news-card-category="${category}" data-news-open data-news-source="${source}" data-news-id="${id}" aria-label="Open ${title}">
                <span class="sba-news-grid-image">
                    <img src="${image}" alt="" loading="lazy" onerror="this.hidden=true; this.parentElement.classList.add('is-fallback');">
                </span>
                <span class="sba-news-grid-copy">
                    <span class="sba-news-grid-meta"><span class="sba-news-grid-badge">${type}</span><time>${date}</time></span>
                    <strong>${title}</strong>
                    <span class="sba-news-grid-excerpt">${excerpt}</span>
                    <span class="sba-news-grid-open">Open article ${newsSvgIcon('next')}</span>
                </span>
            </button>`;
    }

    renderNewsArticlePage(article, list, currentIndex) {
        const newsSection = document.getElementById('hubNewsSection');
        if (!newsSection || !article) return;

        const source = this.currentNewsSource === 'discord' ? 'discord' : 'game';
        const sourceLabel = source === 'discord' ? 'Discord community release' : 'Official Dokkan announcement';
        const articleLabel = source === 'discord' ? 'Batch' : 'Notice';

        newsSection.innerHTML = `
            <header class="sba-news-page-heading">
                <span class="sba-news-identity-icon" aria-hidden="true">${newsSvgIcon('news')}</span>
                <span class="sba-news-title-copy"><strong>Dokkan Newsroom</strong><small>${sourceLabel}</small></span>
            </header>
            ${this.renderCharacterReleaseTicker()}
            <div class="sba-news-shell sba-news-reader-shell" data-news-source="${source}">
                <div class="sba-news-reader-toolbar">
                    <button type="button" class="sba-news-reader-back" data-news-reader-back>${newsSvgIcon('previous')}<span>Back to news</span></button>
                    <div class="sba-news-reader-pagination">
                        <button type="button" class="sba-news-reader-page-btn" data-news-reader-prev ${currentIndex <= 0 ? 'disabled' : ''}>${newsSvgIcon('previous')}<span>Previous</span></button>
                        <span>${articleLabel} ${currentIndex + 1} of ${list.length}</span>
                        <button type="button" class="sba-news-reader-page-btn" data-news-reader-next ${currentIndex >= list.length - 1 ? 'disabled' : ''}><span>Next</span>${newsSvgIcon('next')}</button>
                    </div>
                </div>
                <article class="sba-news-reader-article" aria-labelledby="sbaNewsReaderTitle">
                    <div class="sba-news-reader-source-line"><span>${sourceLabel}</span><span aria-hidden="true">•</span><span>${articleLabel} ${currentIndex + 1}</span></div>
                    ${this.renderArticleBodyHtml(article)}
                </article>
            </div>`;

        newsSection.querySelector('[data-news-reader-back]')?.addEventListener('click', () => this.closeEnlargedArticle());
        newsSection.querySelector('[data-news-reader-prev]')?.addEventListener('click', () => this.prevEnlargedArticle());
        newsSection.querySelector('[data-news-reader-next]')?.addEventListener('click', () => this.nextEnlargedArticle());

        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    /**
     * Renders the newsroom grid. Official announcements and Discord batches
     * share the same card language, while the source toggle controls which
     * feed is shown.
     */
    renderNewsSection() {
        const newsSection = document.getElementById('hubNewsSection');
        if (!newsSection) return;

        if (this.activeArticleView) {
            this.currentNewsSource = this.activeArticleView.source === 'discord' ? 'discord' : 'game';
            const articleList = this.getEnlargedArticleList();
            const article = articleList.find(item => String(item.id) === String(this.activeArticleView.id));
            if (article) {
                this.currentArticleId = article.id;
                this.renderNewsArticlePage(article, articleList, articleList.findIndex(item => String(item.id) === String(article.id)));
                return;
            }
            this.activeArticleView = null;
        }

        const selectedFeed = ['all', 'game', 'discord'].includes(this.currentNewsFeed) ? this.currentNewsFeed : 'all';
        const officialItems = this.getNewsDashboardItems('game').map(item => ({ item, source: 'game' }));
        const discordItems = this.getNewsDashboardItems('discord').map(item => ({ item, source: 'discord' }));
        const gridItems = this.sortNewsDashboardItems(
            selectedFeed === 'game' ? officialItems : selectedFeed === 'discord' ? discordItems : [...officialItems, ...discordItems]
        );
        const categoryDefinitions = [
            ['all', 'All'],
            ['campaign', 'Campaigns'],
            ['summon', 'Summons'],
            ['event', 'Events'],
            ['notice', 'Notices']
        ];
        const categoryButtons = categoryDefinitions
            .map(([value, label]) => `<button type="button" class="sba-news-filter-option ${this.currentCategory === value ? 'is-active' : ''}" data-news-category="${value}" aria-pressed="${this.currentCategory === value}">${label}</button>`)
            .join('');
        const sourceButtons = [
            ['all', 'All news', 'Official + Discord'],
            ['game', 'Official', 'Dokkan announcements'],
            ['discord', 'Discord', 'Community releases']
        ].map(([value, label, detail]) => `
            <button type="button" class="sba-news-filter-option sba-news-source-option ${selectedFeed === value ? 'is-active' : ''}" data-news-source-tab="${value}" aria-pressed="${selectedFeed === value}">
                <span>${label}</span><small>${detail}</small>
            </button>`).join('');
        const sortButtons = [
            ['newest', 'Newest first'],
            ['oldest', 'Oldest first']
        ].map(([value, label]) => `<button type="button" class="sba-news-filter-option ${this.newsSortOrder === value ? 'is-active' : ''}" data-news-sort-order="${value}" aria-pressed="${this.newsSortOrder === value}">${label}</button>`).join('');
        const feedLabel = selectedFeed === 'discord' ? 'Discord community releases' : selectedFeed === 'game' ? 'Official Dokkan announcements' : 'Official Dokkan + Discord';
        const sortLabel = this.newsSortOrder === 'oldest' ? 'oldest first' : 'newest first';
        const newsFilterCount = this.getNewsFilterCount();
        const gridMarkup = gridItems.length
            ? gridItems.map(({ item, source }) => this.renderNewsGridCard(item, source)).join('')
            : `<div class="sba-news-grid-empty"><strong>No matching news</strong><span>Try another source, category, or search term.</span></div>`;

        newsSection.innerHTML = `
            <header class="sba-news-page-heading hub-view-header cards-workspace-header news-workspace-header">
                <div class="cards-workspace-heading news-workspace-heading">
                    <div class="hub-view-info cards-workspace-title news-workspace-title">
                        <span class="cards-workspace-title-icon news-workspace-title-icon" aria-hidden="true">${newsSvgIcon('news')}</span>
                        <div>
                            <h2 class="hub-section-title" id="newsViewTitle">Dokkan Newsroom</h2>
                            <p class="hub-section-subtitle" id="newsViewSubtitle">${feedLabel}</p>
                        </div>
                    </div>
                    <div class="cards-workspace-divider" aria-hidden="true"></div>
                    <div class="cards-workspace-actions news-workspace-actions">
                        <div class="cards-search-toolbar news-search-toolbar">
                            <button type="button" class="liquid-toolbar-filter-btn${newsFilterCount ? ' active' : ''}" id="newsFiltersBtn" aria-expanded="false" aria-controls="sbaNewsFilterPopover">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"></path></svg>
                                <span class="filter-button-label">Filters</span>
                                <span class="advanced-filter-count" id="newsFilterCount" ${newsFilterCount ? '' : 'hidden'}>${newsFilterCount}</span>
                            </button>
                            <div class="sba-news-filter-popover" id="sbaNewsFilterPopover" aria-hidden="true">
                                <div class="sba-news-filter-popover-header">
                                    <span>News filters</span>
                                    <button type="button" class="sba-news-filter-reset" data-news-filter-reset>Reset</button>
                                </div>
                                <div class="sba-news-filter-group">
                                    <span class="sba-news-filter-label">Source</span>
                                    <div class="sba-news-filter-options">${sourceButtons}</div>
                                </div>
                                ${selectedFeed === 'discord' ? '' : `<div class="sba-news-filter-group"><span class="sba-news-filter-label">Category</span><div class="sba-news-filter-options">${categoryButtons}</div></div>`}
                                <div class="sba-news-filter-group">
                                    <span class="sba-news-filter-label">Release date</span>
                                    <div class="sba-news-filter-options">${sortButtons}</div>
                                </div>
                            </div>
                            <div class="liquid-search-border-container news-search-border">
                                <div class="liquid-search-box" role="search" tabindex="0" onclick="this.querySelector('input')?.focus()">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 30 30" fill="#94a3b8" class="search-icon" aria-hidden="true"><path d="M13 3C7.489 3 3 7.489 3 13s4.489 10 10 10a9.95 9.95 0 0 0 6.322-2.264l5.971 5.971a1 1 0 1 0 1.414-1.414l-5.97-5.97A9.95 9.95 0 0 0 23 13c0-5.511-4.489-10-10-10m0 2c4.43 0 8 3.57 8 8s-3.57 8-8 8-8-3.57-8-8 3.57-8 8-8"/></svg>
                                    <input type="search" id="newsSearchInput" value="${escapeNewsHtml(this.searchQuery)}" placeholder="Search news..." autocomplete="off">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            ${this.renderCharacterReleaseTicker()}
            <div class="sba-news-shell sba-news-grid-shell">
                <div class="sba-news-grid-summary"><span><strong>${gridItems.length}</strong> updates</span><span>${feedLabel} · ${sortLabel}</span></div>
                <section class="sba-news-card-grid" aria-label="${escapeNewsHtml(feedLabel)}" aria-live="polite">
                    ${gridMarkup}
                </section>
            </div>`;

        newsSection.querySelectorAll('[data-news-open]').forEach(button => {
            button.addEventListener('click', () => this.openEnlargedArticle(button.dataset.newsId, button.dataset.newsSource));
        });
        newsSection.querySelectorAll('[data-news-source-tab]').forEach(button => {
            button.addEventListener('click', () => this.setNewsFeed(button.dataset.newsSourceTab));
        });
        newsSection.querySelectorAll('[data-news-category]').forEach(button => {
            button.addEventListener('click', () => this.setCategory(button.dataset.newsCategory));
        });
        newsSection.querySelectorAll('[data-news-sort-order]').forEach(button => {
            button.addEventListener('click', () => this.setNewsSortOrder(button.dataset.newsSortOrder));
        });
        newsSection.querySelector('[data-news-filter-reset]')?.addEventListener('click', () => this.resetNewsFilters());
        const newsFilterButton = newsSection.querySelector('#newsFiltersBtn');
        const newsFilterPopover = newsSection.querySelector('#sbaNewsFilterPopover');
        newsFilterButton?.addEventListener('click', event => {
            event.stopPropagation();
            const isOpen = !newsFilterPopover?.classList.contains('is-open');
            newsFilterPopover?.classList.toggle('is-open', isOpen);
            newsFilterPopover?.setAttribute('aria-hidden', String(!isOpen));
            newsFilterButton.setAttribute('aria-expanded', String(isOpen));
            newsFilterButton.classList.toggle('active', isOpen || newsFilterCount > 0);
        });
        const searchInput = newsSection.querySelector('#newsSearchInput');
        searchInput?.addEventListener('input', event => {
            this.handleSearch(event.currentTarget.value, event.currentTarget.selectionStart);
        });
        return;

        {
        const selectedFeed = ['all', 'game', 'discord'].includes(this.currentNewsFeed) ? this.currentNewsFeed : 'all';
        const activeSource = selectedFeed === 'discord' && this.discordBatches.length ? 'discord' : 'game';
        const companionSource = activeSource === 'game' ? 'discord' : 'game';
        const activeItems = this.getNewsDashboardItems(activeSource);
        const isDiscordFeed = selectedFeed === 'discord' && activeSource === 'discord';
        const showCompanionFeed = selectedFeed === 'all';
        const companionItems = showCompanionFeed ? this.getNewsDashboardItems(companionSource) : [];
        const featuredItems = isDiscordFeed ? activeItems : this.getCampaignShowcaseItems();
        const featuredSource = isDiscordFeed ? 'discord' : 'game';
        const featuredIndex = featuredItems.length ? this.featuredNewsIndex % featuredItems.length : 0;
        const featured = featuredItems[featuredIndex] || null;
        const latestIssue = (this.articles || []).find(item => item.category === 'notice') || null;
        const relatedItems = activeItems.filter(item => !featured || String(item.id) !== String(featured.id)).slice(0, 12);
        const latestItems = companionItems.slice(0, 12);
        const editorialItems = (relatedItems.length ? relatedItems : activeItems).slice(0, 4);
        const activeLabel = activeSource === 'discord' ? 'Discord' : 'Dokkan Announcements';
        const companionLabel = companionSource === 'discord' ? 'Discord' : 'Dokkan Announcements';
        const categoryDefinitions = [
            ['all', 'All'],
            ['campaign', 'Campaigns'],
            ['summon', 'Summons'],
            ['event', 'Events'],
            ['notice', 'Notices']
        ];
        const categoryButtons = categoryDefinitions.map(([value, label]) => `<button type="button" class="sba-news-category ${this.currentCategory === value ? 'is-active' : ''}" data-news-category="${value}">${label}</button>`).join('');
        const scrollControls = (targetId, label) => `
            <span class="sba-news-scroll-controls" aria-label="${label}">
                <button type="button" data-news-scroll data-news-scroll-target="${targetId}" data-news-scroll-direction="-1" aria-label="Previous">${newsSvgIcon('previous')}</button>
                <button type="button" data-news-scroll data-news-scroll-target="${targetId}" data-news-scroll-direction="1" aria-label="Next">${newsSvgIcon('next')}</button>
            </span>`;

        const renderShowcaseMarkup = (item, source, label) => item ? (() => {
            const image = escapeNewsHtml(this.getNewsDashboardImage(item));
            const title = escapeNewsHtml(item.title || 'Dokkan Announcement');
            const excerpt = escapeNewsHtml(this.getNewsDashboardExcerpt(item));
            const date = escapeNewsHtml(this.getNewsDashboardDate(item));
            const type = escapeNewsHtml(this.getNewsDashboardType(item, source));
            const id = escapeNewsHtml(item.id);
            return `
                <button type="button" class="sba-news-featured-action" data-news-open data-news-source="${source}" data-news-id="${id}">
                    <span class="sba-news-featured-heading">
                        <span class="sba-news-featured-campaign"><span>${label}</span><span>${type}<span aria-hidden="true">•</span>${date}</span></span>
                        <strong>${title}</strong>
                    </span>
                    <span class="sba-news-featured-media"><img src="${image}" alt="" loading="eager" onerror="this.hidden=true;this.parentElement.classList.add('is-fallback')"></span>
                    <span class="sba-news-featured-details"><span>${excerpt}</span><span class="sba-news-open-label">Open full notice ${newsSvgIcon('next')}</span></span>
                </button>`;
        })() : `<div class="sba-news-empty-state">No notices are available yet.</div>`;
        const featuredMarkup = renderShowcaseMarkup(featured, featuredSource, 'Campaign');
        const discordShowcaseMarkup = renderShowcaseMarkup(featured, 'discord', 'Discord release');
        const issueMarkup = renderShowcaseMarkup(latestIssue, 'game', 'Issue');

        newsSection.innerHTML = `
            <header class="sba-news-page-heading">
                <span class="sba-news-identity-icon" aria-hidden="true">${newsSvgIcon('news')}</span>
                <span class="sba-news-title-copy"><strong>Dokkan Newsroom</strong><small>Official Dokkan Announcements · Discord</small></span>
            </header>
            ${this.renderCharacterReleaseTicker()}
            <div class="sba-news-shell">
                <header class="sba-news-topbar">
                    <nav class="sba-news-source-nav" aria-label="News source">
                        <button type="button" class="${selectedFeed === 'all' ? 'is-active' : ''}" data-news-source-tab="all" aria-pressed="${selectedFeed === 'all'}"><span>All News</span><small>Official + Discord</small></button>
                        <button type="button" class="${selectedFeed === 'game' ? 'is-active' : ''}" data-news-source-tab="game" aria-pressed="${selectedFeed === 'game'}"><span>Official Dokkan</span><small>Announcements</small></button>
                        <button type="button" class="${selectedFeed === 'discord' ? 'is-active' : ''}" data-news-source-tab="discord" aria-pressed="${selectedFeed === 'discord'}"><span>Discord</span><small>Community feed</small></button>
                    </nav>
                    <label class="sba-news-search" for="newsSearchInput">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
                        <input type="search" id="newsSearchInput" value="${escapeNewsHtml(this.searchQuery)}" placeholder="Search news" autocomplete="off">
                    </label>
                </header>

                ${selectedFeed === 'discord' ? '' : `<div class="sba-news-category-nav" aria-label="Official news category">${categoryButtons}</div>`}

                <div class="sba-news-dashboard ${showCompanionFeed ? 'is-all-news' : 'is-single-source'}">
                    <div class="sba-news-showcase-stack${isDiscordFeed ? ' sba-news-discord-showcase-stack' : ''}">
                        <article class="sba-news-featured-card sba-news-campaign-showcase${isDiscordFeed ? ' sba-news-discord-showcase' : ''}${this.featuredShouldFadeIn ? ' is-rotating-in' : ''}" data-news-source="${featuredSource}">
                            ${isDiscordFeed ? discordShowcaseMarkup : featuredMarkup}
                        </article>
                        ${isDiscordFeed ? '' : `<article class="sba-news-featured-card sba-news-campaign-showcase sba-news-issue-showcase" data-news-source="game">
                            ${issueMarkup}
                        </article>`}
                    </div>

                    <section class="sba-news-related-panel" aria-labelledby="sbaNewsRelatedTitle">
                        <header>
                            <div>
                                <h2 id="sbaNewsRelatedTitle">Related news</h2>
                                <span class="sba-news-kicker">${escapeNewsHtml(activeLabel)}</span>
                            </div>
                            <span class="sba-news-panel-actions"><span class="sba-news-item-count">${activeItems.length}</span>${scrollControls('sbaNewsRelatedList', 'Scroll related news')}</span>
                        </header>
                        <ol class="sba-news-list" id="sbaNewsRelatedList">
                            ${relatedItems.length ? relatedItems.map(item => this.renderNewsDashboardRow(item, activeSource)).join('') : '<li class="sba-news-list-empty">No more matching updates.</li>'}
                        </ol>
                    </section>

                    ${showCompanionFeed ? `<aside class="sba-news-latest-panel" aria-labelledby="sbaNewsLatestTitle">
                        <header>
                            <div>
                                <h2 id="sbaNewsLatestTitle">Latest updates</h2>
                                <span class="sba-news-kicker">${escapeNewsHtml(companionLabel)}</span>
                            </div>
                            <span class="sba-news-panel-actions"><button type="button" class="sba-news-switch-source" data-news-source-tab="${companionSource}">View ${companionSource === 'discord' ? 'Discord' : 'official'}</button>${scrollControls('sbaNewsLatestList', 'Scroll latest news')}</span>
                        </header>
                        <ol class="sba-news-compact-list" id="sbaNewsLatestList">
                            ${latestItems.length ? latestItems.map(item => this.renderNewsCompactRow(item, companionSource)).join('') : '<li class="sba-news-list-empty">No matching updates.</li>'}
                        </ol>
                    </aside>` : ''}
                </div>

                <section class="sba-news-editorial-rail" aria-labelledby="sbaNewsEditorialTitle">
                    <header class="sba-news-rail-heading">
                        <div>
                            <span class="sba-news-rail-kicker">News feed</span>
                            <h2 id="sbaNewsEditorialTitle">More updates</h2>
                        </div>
                        <span class="sba-news-rail-note">More from ${escapeNewsHtml(activeLabel)}</span>
                    </header>
                    <div class="sba-news-editorial-grid">
                        ${editorialItems.length ? editorialItems.map(item => this.renderNewsEditorialCard(item, activeSource)).join('') : '<div class="sba-news-list-empty">No matching updates.</div>'}
                    </div>
                </section>
            </div>`;

        newsSection.querySelectorAll('[data-news-open]').forEach(button => {
            button.addEventListener('click', () => this.openEnlargedArticle(button.dataset.newsId, button.dataset.newsSource));
        });
        newsSection.querySelectorAll('[data-news-source-tab]').forEach(button => {
            button.addEventListener('click', () => this.setNewsFeed(button.dataset.newsSourceTab));
        });
        newsSection.querySelectorAll('[data-news-category]').forEach(button => {
            button.addEventListener('click', () => this.setCategory(button.dataset.newsCategory));
        });
        const searchInput = newsSection.querySelector('#newsSearchInput');
        searchInput?.addEventListener('input', event => {
            this.handleSearch(event.currentTarget.value, event.currentTarget.selectionStart);
        });
        newsSection.querySelectorAll('[data-news-scroll]').forEach(button => {
            button.addEventListener('click', () => {
                const target = newsSection.querySelector(`#${button.dataset.newsScrollTarget}`);
                const direction = Number(button.dataset.newsScrollDirection) || 1;
                target?.scrollBy({ top: target.clientHeight * 0.72 * direction, behavior: 'smooth' });
            });
        });
        this.ensureFeaturedNewsRotation();
        }
    }

    renderGameNewsListHtml() {
        let filtered = [...this.articles];
        if (this.currentCategory !== 'all') {
            filtered = filtered.filter(a => a.category === this.currentCategory);
        }
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(a => {
                const titleMatch = (a.title || '').toLowerCase().includes(q);
                const bodyMatch = (a.bodies || []).some(b => (b.description || '').toLowerCase().includes(q));
                return titleMatch || bodyMatch;
            });
        }

        if (filtered.length === 0) {
            return `<div class="news-no-results">No In-Game notices found matching "${this.searchQuery}"</div>`;
        }

        return filtered.map(art => {
            const catBadge = this.getCategoryBadge(art.category);
            let imgUrl = normalizeDokkanNewsUrl(art.banner)
                || (art.bodies && art.bodies.find(s => s.image)?.image)
                || (art.banner && art.banner !== DOKKAN_NO_NEWS_IMG ? art.banner : null)
                || DOKKAN_NO_NEWS_IMG;
            const idArg = typeof art.id === 'string' ? `'${art.id}'` : art.id;

            return `
                <div class="news-stream-card" onclick="window.dokkanNews.openEnlargedArticle(${idArg}, 'game')" title="Click to view full notice">
                    <div class="news-card-thumb">
                        <img src="${imgUrl}" alt="Banner" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                    </div>
                    <div class="news-card-body">
                        <div class="news-card-meta">
                            ${catBadge}
                            <span class="news-card-date">${art.date_added}</span>
                        </div>
                        <h4 class="news-card-title">${art.title}</h4>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDiscordNewsListHtml() {
        let filtered = [...this.discordBatches];
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            filtered = filtered.filter(b => {
                const titleMatch = (b.title || '').toLowerCase().includes(q);
                const bodyMatch = (b.bodies || []).some(seg => (seg.description || '').toLowerCase().includes(q));
                return titleMatch || bodyMatch;
            });
        }

        if (filtered.length === 0) {
            return `<div class="news-no-results">No Discord releases found matching "${this.searchQuery}"</div>`;
        }

        return filtered.map(batch => {
            const catBadge = this.getCategoryBadge('discord');
            let imgUrl = (batch.media && batch.media.find(m => m.type === 'image')?.url)
                || (batch.banner && batch.banner !== DOKKAN_NO_NEWS_IMG ? batch.banner : null)
                || (batch.bodies && batch.bodies.find(s => s.image)?.image)
                || DOKKAN_NO_NEWS_IMG;
            const idArg = typeof batch.id === 'string' ? `'${batch.id}'` : batch.id;
            const countBadge = batch.mediaCount ? `<span class="discord-media-count-tag">${batch.mediaCount} Visuals</span>` : '';

            return `
                <div class="news-stream-card discord-stream-card" onclick="window.dokkanNews.openEnlargedArticle(${idArg}, 'discord')" title="Click to view batch release">
                    <div class="news-card-thumb">
                        <img src="${imgUrl}" alt="Banner" loading="lazy" onerror="this.onerror=null; this.src='${DOKKAN_NO_NEWS_IMG}';">
                    </div>
                    <div class="news-card-body">
                        <div class="news-card-meta">
                            ${catBadge}
                            ${countBadge}
                            <span class="news-card-date">${batch.date_added}</span>
                        </div>
                        <h4 class="news-card-title">${batch.title}</h4>
                    </div>
                </div>
            `;
        }).join('');
    }

    setCategory(cat) {
        this.activeArticleView = null;
        this.currentCategory = cat || 'all';
        this.featuredNewsIndex = 0;
        this.renderNewsSection();
        this.restoreNewsFilterPopover();
    }

    getNewsFilterCount() {
        return [
            this.currentNewsFeed !== 'all',
            this.currentCategory !== 'all',
            this.newsSortOrder !== 'newest'
        ].filter(Boolean).length;
    }

    restoreNewsFilterPopover() {
        const filterButton = document.getElementById('newsFiltersBtn');
        const filterPopover = document.getElementById('sbaNewsFilterPopover');
        if (!filterButton || !filterPopover) return;

        filterPopover.classList.add('is-open');
        filterPopover.setAttribute('aria-hidden', 'false');
        filterButton.setAttribute('aria-expanded', 'true');
        filterButton.classList.add('active');
    }

    resetNewsFilters() {
        this.activeArticleView = null;
        this.currentNewsFeed = 'all';
        this.currentNewsSource = 'game';
        this.currentCategory = 'all';
        this.newsSortOrder = 'newest';
        this.featuredNewsIndex = 0;
        this.renderNewsSection();
        this.restoreNewsFilterPopover();
    }

    setNewsSortOrder(order) {
        this.activeArticleView = null;
        this.newsSortOrder = order === 'oldest' ? 'oldest' : 'newest';
        this.renderNewsSection();
        this.restoreNewsFilterPopover();
    }

    handleSearch(query, caret = null) {
        this.activeArticleView = null;
        this.searchQuery = (query || '').trim().toLowerCase();
        this.renderNewsSection();
        if (caret !== null) {
            requestAnimationFrame(() => {
                const input = document.getElementById('newsSearchInput');
                if (!input) return;
                input.focus();
                const position = Math.min(caret, input.value.length);
                input.setSelectionRange(position, position);
            });
        }
    }

    setNewsSource(source) {
        this.activeArticleView = null;
        this.currentNewsSource = source === 'discord' ? 'discord' : 'game';
        this.currentNewsFeed = this.currentNewsSource;
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.renderNewsSection();
    }

    openBatchMedia(batchIndex, mediaIndex) {
        const list = this.discordBatches;
        const batch = list[batchIndex];
        if (!batch || !batch.media || batch.media.length === 0) return;

        this.campaignGallery = batch.media;
        this.openGalleryIndex(mediaIndex);
    }
}

// Global instance
window.dokkanNews = new DokkanNewsEngine();

// Convenience helper to switch to news view and focus an article
window.openDokkanNewsArticle = function(id, source = 'game') {
    const newsSource = source === 'discord' ? 'discord' : 'game';
    if (typeof switchHubView === 'function') {
        switchHubView('news', newsSource);
    }
    if (window.dokkanNews) {
        window.dokkanNews.openEnlargedArticle(id, newsSource);
    }
    try {
        const url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('view', 'news');
        url.searchParams.set('source', newsSource);
        url.searchParams.set('article', String(id));
        window.history.replaceState({}, document.title, url.pathname + url.search);
    } catch (e) {
    }
};

// Global sync helper for manual News & Discord refresh
window.syncLiveNews = async function(btnEl) {
    const originalContent = btnEl ? btnEl.innerHTML : null;
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.style.pointerEvents = 'none';
        btnEl.innerHTML = `
            <span class="sync-icon" style="display:inline-flex; align-items:center; animation: spin 1s linear infinite;">${newsSvgIcon('refresh')}</span>
            <span>Syncing News...</span>
        `;
    }

    try {
        const response = await fetch('http://localhost:3001/api/sync-all-news', {
            method: 'POST',
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            if (btnEl) btnEl.innerHTML = `<span class="sync-icon">${newsSvgIcon('check')}</span><span>Sync Started!</span>`;
            if (window.dokkanNews) {
                setTimeout(async () => {
                    await window.dokkanNews.init();
                }, 2000);
            }
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (e) {
        console.warn("Manual news sync failed:", e.message);
        if (btnEl) {
            btnEl.innerHTML = `<span class="sync-icon">${newsSvgIcon('warning')}</span><span>Server Offline</span>`;
            alert("Dokkan Live Bridge server is not running.\n\nTo enable live scraping and news sync, start the server in your terminal:\n  node server.js\n\n(Make sure it is running at http://localhost:3001)");
        }
    } finally {
        if (btnEl && originalContent) {
            setTimeout(() => {
                btnEl.innerHTML = originalContent;
                btnEl.disabled = false;
                btnEl.style.pointerEvents = 'auto';
            }, 3000);
        }
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.dokkanNews.init();
});
