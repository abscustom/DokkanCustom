/* ==========================================================================
   json-card-loader.js - Async Database Loader with SA Chain Resolution
   ========================================================================== */

window.DB = {
    cards: [], leaders: {}, passives: {}, actives: {}, standbys: {}, 
    finishes: {}, fields: {}, links: {}, categories: {}, awakeningRoutes: [],
    cardSpecials: {}, cardSpecialsByCard: {}, specials: {}, specialViews: {}, specialCategories: {}, optimalAwakeningGrowths: []
};

async function fetchJsonSafely(filename) {
    const paths = [`json/${filename}`, filename, `./json/${filename}`, `./${filename}`];
    for (const p of paths) {
        try {
            const res = await fetch(p);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {}
    }
    return null;
}

async function loadDokkanDatabase() {
    try {
        console.log("Loading Dokkan JSON Database...");

        const [
            cards, leaders, passives, actives, standbys,
            finishes, fields, links, categories, routes, 
            cardSpecials, specials, specialViews, specialCategories, optimalGrowths
        ] = await Promise.all([
            fetchJsonSafely('cards.json'),
            fetchJsonSafely('leader_skills.json'),
            fetchJsonSafely('passive_skills.json'),
            fetchJsonSafely('active_skills.json'),
            fetchJsonSafely('standby_skills.json'),
            fetchJsonSafely('finish_skills.json'),
            fetchJsonSafely('dokkan_fields.json'),
            fetchJsonSafely('link_skills.json'),
            fetchJsonSafely('card_categories.json'),
            fetchJsonSafely('awakening_routes.json'),
            fetchJsonSafely('card_specials.json'),
            fetchJsonSafely('specials.json'),
            fetchJsonSafely('special_views.json'),
            fetchJsonSafely('special_categories.json'),
            fetchJsonSafely('optimal_awakening_growths.json')
        ]);

        if (cards) DB.cards = Array.isArray(cards) ? cards : Object.values(cards);
        if (routes) DB.awakeningRoutes = Array.isArray(routes) ? routes : Object.values(routes);
        if (optimalGrowths) DB.optimalAwakeningGrowths = Array.isArray(optimalGrowths) ? optimalGrowths : Object.values(optimalGrowths);

        DB.leaders = {};
        if (leaders) {
            (Array.isArray(leaders) ? leaders : Object.values(leaders)).forEach(l => {
                if (l && l.id) DB.leaders[String(l.id)] = l;
            });
        }

        DB.passives = {};
        if (passives) {
            (Array.isArray(passives) ? passives : Object.values(passives)).forEach(p => {
                if (p && p.id) DB.passives[String(p.id)] = p;
            });
        }

        DB.actives = {};
        if (actives) {
            (Array.isArray(actives) ? actives : Object.values(actives)).forEach(a => {
                if (a && a.id) DB.actives[String(a.id)] = a;
            });
        }

        DB.standbys = {};
        if (standbys) {
            (Array.isArray(standbys) ? standbys : Object.values(standbys)).forEach(s => {
                if (s && s.id) DB.standbys[String(s.id)] = s;
            });
        }

        DB.finishes = {};
        if (finishes) {
            (Array.isArray(finishes) ? finishes : Object.values(finishes)).forEach(f => {
                if (f && f.id) DB.finishes[String(f.id)] = f;
            });
        }

        DB.fields = {};
        if (fields) {
            (Array.isArray(fields) ? fields : Object.values(fields)).forEach(f => {
                if (f && f.id) DB.fields[String(f.id)] = f;
            });
        }

        DB.links = {};
        if (links) {
            (Array.isArray(links) ? links : Object.values(links)).forEach(l => {
                if (l && l.id) DB.links[String(l.id)] = l;
            });
        }

        DB.categories = {};
        if (categories) {
            (Array.isArray(categories) ? categories : Object.values(categories)).forEach(c => {
                if (c && c.id) DB.categories[String(c.id)] = c;
            });
        }

        // 1. Index card_specials by row ID and card_id
        DB.cardSpecials = {};
        DB.cardSpecialsByCard = {};
        if (cardSpecials) {
            (Array.isArray(cardSpecials) ? cardSpecials : Object.values(cardSpecials)).forEach(cs => {
                if (!cs) return;
                if (cs.id) DB.cardSpecials[String(cs.id)] = cs;
                if (cs.card_id) {
                    const cid = String(cs.card_id);
                    if (!DB.cardSpecialsByCard[cid]) DB.cardSpecialsByCard[cid] = [];
                    DB.cardSpecialsByCard[cid].push(cs);
                }
            });
        }

        // 2. Index specials by id
        DB.specials = {};
        if (specials) {
            (Array.isArray(specials) ? specials : Object.values(specials)).forEach(sa => {
                if (sa && sa.id) DB.specials[String(sa.id)] = sa;
            });
        }

        // 3. Index special_views by id (contains special_category_id)
        DB.specialViews = {};
        if (specialViews) {
            (Array.isArray(specialViews) ? specialViews : Object.values(specialViews)).forEach(sv => {
                if (sv && sv.id) DB.specialViews[String(sv.id)] = sv;
            });
        }

        // 4. Index special_categories
        DB.specialCategories = {};
        if (specialCategories) {
            (Array.isArray(specialCategories) ? specialCategories : Object.values(specialCategories)).forEach(sc => {
                if (sc && sc.id) DB.specialCategories[String(sc.id)] = sc;
            });
        }

        console.log(`SUCCESS! Loaded ${DB.cards.length} cards + SA relational tables.`);
        return true;
    } catch (error) {
        console.error("Database load error:", error);
        return false;
    }
}