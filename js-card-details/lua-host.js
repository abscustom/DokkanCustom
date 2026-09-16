/* ==========================================================================
   absCustom - Fengari Lua Host Bridge
   ========================================================================== */

function adoptFengariFromGlobal() {
    if (globalThis.fengari?.lua) return globalThis.fengari;
    try {
        if (typeof module !== 'undefined' && module?.exports?.lua) {
            globalThis.fengari = module.exports;
            return globalThis.fengari;
        }
    } catch {}
    try {
        const ex = globalThis.exports;
        if (ex?.fengari?.lua) {
            globalThis.fengari = ex.fengari;
            return globalThis.fengari;
        }
    } catch {}
    return null;
}

export function getFengari() {
    if (globalThis.fengari?.lua) return globalThis.fengari;
    return adoptFengariFromGlobal();
}

let fengariLoadPromise = null;

export function ensureFengari() {
    const existing = getFengari();
    if (existing) return Promise.resolve(existing);
    if (fengariLoadPromise) return fengariLoadPromise;

    fengariLoadPromise = new Promise((resolve, reject) => {
        if (typeof document === 'undefined') {
            reject(new Error('Cannot load fengari outside browser context'));
            return;
        }
        const script = document.createElement('script');
        script.src = 'vendor/fengari-web.min.js';
        script.async = false;
        script.onload = () => {
            adoptFengariFromGlobal();
            const fg = getFengari();
            if (fg) resolve(fg);
            else reject(new Error('fengari-web loaded but fengari global is missing'));
        };
        script.onerror = () => reject(new Error('Failed to load vendor/fengari-web.min.js'));
        document.head.appendChild(script);
    }).catch((err) => {
        fengariLoadPromise = null;
        throw err;
    });

    return fengariLoadPromise;
}

export function num(L, i) {
    const fg = getFengari();
    if (!fg) return 0;
    const { lua } = fg;
    if (lua.lua_isnoneornil(L, i)) return 0;
    return Number(lua.lua_tonumber(L, i)) || 0;
}

export function str(L, i) {
    const fg = getFengari();
    if (!fg) return '';
    const { lua, to_jsstring } = fg;
    if (lua.lua_isnoneornil(L, i)) return '';
    if (!lua.lua_isstring(L, i)) return String(lua.lua_tonumber(L, i) || '');
    const raw = lua.lua_tostring(L, i);
    if (!raw) return '';
    try {
        return to_jsstring(raw, 0, raw.length, true);
    } catch {
        return new TextDecoder('utf-8', { fatal: false }).decode(raw);
    }
}

function asciiChunkName(name) {
    const base = String(name || 'script').replace(/[^\x20-\x7E]/g, '_').slice(0, 60);
    return `@${base}`;
}

export function createLuaHost() {
    const fg = getFengari();
    if (!fg) {
        throw new Error('Fengari is not loaded. Call ensureFengari() first.');
    }
    const { lua, lauxlib, lualib, to_luastring } = fg;
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    const register = (name, handler) => {
        lua.lua_pushcfunction(L, (LL) => {
            try {
                const ret = handler(LL);
                if (ret === undefined || ret === null) return 0;
                if (typeof ret === 'number') {
                    lua.lua_pushnumber(LL, ret);
                    return 1;
                }
                if (typeof ret === 'boolean') {
                    lua.lua_pushboolean(LL, ret ? 1 : 0);
                    return 1;
                }
                lua.lua_pushstring(LL, to_luastring(String(ret)));
                return 1;
            } catch (e) {
                const msg = String(e && e.message ? e.message : e).replace(/[^\x20-\x7E]/g, '?');
                lauxlib.luaL_error(LL, to_luastring(msg));
                return 0;
            }
        });
        lua.lua_setglobal(L, to_luastring(name));
    };

    const setGlobalNumber = (name, value) => {
        lua.lua_pushnumber(L, Number(value) || 0);
        lua.lua_setglobal(L, to_luastring(name));
    };

    const setGlobalString = (name, value) => {
        lua.lua_pushstring(L, to_luastring(String(value ?? '')));
        lua.lua_setglobal(L, to_luastring(name));
    };

    const run = (source, chunkName = 'script') => {
        const bytes = to_luastring(source);
        const name = to_luastring(asciiChunkName(chunkName));
        const status = lauxlib.luaL_loadbuffer(L, bytes, bytes.length, name);
        if (status !== lua.LUA_OK) {
            const err = str(L, -1);
            lua.lua_pop(L, 1);
            throw new Error(`Lua compilation error: ${err}`);
        }
        const call = lua.lua_pcall(L, 0, lua.LUA_MULTRET, 0);
        if (call !== lua.LUA_OK) {
            const err = str(L, -1);
            lua.lua_pop(L, 1);
            throw new Error(`Lua execution error: ${err}`);
        }
    };

    return { L, register, setGlobalNumber, setGlobalString, run, num, str };
}
