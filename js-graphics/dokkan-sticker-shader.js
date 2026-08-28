/* ==========================================================================
   Dokkan TUR Special Sticker WebGL Shader Engine (INSTANT LOAD - MAP BASED)
   ========================================================================== */

class DokkanStickerRunner {
    // Shared globally so it only downloads the map ONCE per page load
    static globalStickerMap = null;

    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', { 
            alpha: true, 
            premultipliedAlpha: true, 
            antialias: true 
        });
        this.program = null;
        this.stickerConfig = null;
        this.startTime = 0;
        this.animationFrameId = null;
        this.textures = [];
    }

    play() {
        if (this.animationFrameId === null && this.gl && this.program) {
            this.startTime = performance.now();
            this._renderLoop();
        }
    }

    pause() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    destroy() {
        this.pause();
        if (this.gl) {
            if (this.program) this.gl.deleteProgram(this.program);
            this.textures.forEach(t => this.gl.deleteTexture(t));
            this.textures = [];
            this.program = null;
        }
    }

    async getStickerMap() {
        if (DokkanStickerRunner.globalStickerMap) return DokkanStickerRunner.globalStickerMap;
        try {
            // Changed this line to look inside the "json" folder!
            const res = await fetch('/json/sticker_map.json'); 
            if (res.ok) {
                DokkanStickerRunner.globalStickerMap = await res.json();
                return DokkanStickerRunner.globalStickerMap;
            }
        } catch (e) {
            console.warn("[Sticker Engine] sticker_map.json not found. Falling back to guessing.");
        }
        return {};
    }

    async findDecorationJson(baseFolder, folderId, cardObj = null) {
        // 1. INSTANT LOOKUP VIA MAP
        const map = await this.getStickerMap();
        const rawId = cardObj ? parseInt(cardObj.id, 10) : parseInt(folderId, 10);
        const normId = rawId > 10000000 ? Math.floor(rawId / 10) : rawId;
        const parentFolder = Math.floor(normId / 10) * 10;

        // Check if the exact folder or the parent folder has a mapped JSON
        const exactFile = map[folderId] || map[String(rawId)] || map[String(normId)] || map[String(parentFolder)];

        if (exactFile) {
            const url = `${baseFolder}${exactFile}`;
            try {
                const res = await fetch(url);
                if (res.ok) {
                    console.log(`[Sticker Engine] Instant load success: ${url}`);
                    return { config: await res.json(), url };
                }
            } catch (e) {}
        }

        // 2. FALLBACK (Only runs if the character isn't in your sticker_map.json)
        console.warn(`[Sticker Engine] ID ${folderId} not found in map. Falling back to standard check.`);
        const genericFiles = [
            `card_${folderId}_decoration_0000480.json`,
            `card_${folderId}_decoration_0000066.json`,
            `card_${folderId}_decoration.json`,
            `decoration.json`
        ];

        for (const file of genericFiles) {
            const url = `${baseFolder}${file}`;
            try {
                const res = await fetch(url);
                if (res.ok) return { config: await res.json(), url };
            } catch(e) {}
        }

        return null;
    }

    async loadConfig(folderId, cardObj = null) {
        if (!this.gl) return false;

        if (!this.canvas.width || this.canvas.width === 300) {
            this.canvas.width = 426;
            this.canvas.height = 568;
        }

        const baseFolder = `assets/card/${folderId}/`;
        const matchResult = await this.findDecorationJson(baseFolder, folderId, cardObj);
        if (!matchResult) return false;

        const configRaw = matchResult.config;
        const pMap = {};
        const registerParam = (key, value) => {
            if (!key) return;
            pMap[key] = value;
            pMap[key.toLowerCase()] = value;
            pMap[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = value;
        };

        if (Array.isArray(configRaw.parameters)) {
            configRaw.parameters.forEach(p => {
                if (p && p.name !== undefined) registerParam(p.name, p.value);
            });
        } else if (typeof configRaw === 'object') {
            Object.entries(configRaw).forEach(([k, v]) => registerParam(k, v));
        }

        const findParam = (searchKeys, fallback) => {
            for (const k of searchKeys) {
                if (pMap[k] !== undefined && pMap[k] !== null && pMap[k] !== '') return pMap[k];
                const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (pMap[clean] !== undefined && pMap[clean] !== null && pMap[clean] !== '') return pMap[clean];
            }
            return fallback;
        };

        const getTexName = (path, fallback) => {
            if (!path) return fallback;
            return String(path).replace(/\\/g, '/').split('/').pop();
        };

        const parseVec2 = (val, def = [0, 0]) => {
            if (val === undefined || val === null) return def;
            if (Array.isArray(val)) return [parseFloat(val[0]) || def[0], parseFloat(val[1]) || def[1]];
            if (typeof val === 'object') {
                const x = val.x !== undefined ? val.x : (val.r !== undefined ? val.r : val[0]);
                const y = val.y !== undefined ? val.y : (val.g !== undefined ? val.g : val[1]);
                if (x !== undefined && y !== undefined) return [parseFloat(x) || def[0], parseFloat(y) || def[1]];
            }
            if (typeof val === 'string') {
                const nums = val.replace(/[{}[\]]/g, '').split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
                if (nums.length >= 2) return [nums[0], nums[1]];
            }
            return def;
        };

        const parseVec3 = (val, def = [1, 1, 1]) => {
            if (val === undefined || val === null) return def;
            if (Array.isArray(val)) return [parseFloat(val[0]) || def[0], parseFloat(val[1]) || def[1], parseFloat(val[2]) || def[2]];
            if (typeof val === 'object') {
                const r = val.r !== undefined ? val.r : (val.x !== undefined ? val.x : val[0]);
                const g = val.g !== undefined ? val.g : (val.y !== undefined ? val.y : val[1]);
                const b = val.b !== undefined ? val.b : (val.z !== undefined ? val.z : val[2]);
                if (r !== undefined && g !== undefined && b !== undefined) return [parseFloat(r) || def[0], parseFloat(g) || def[1], parseFloat(b) || def[2]];
            }
            if (typeof val === 'string') {
                const nums = val.replace(/[{}[\]]/g, '').split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
                if (nums.length >= 3) return [nums[0], nums[1], nums[2]];
            }
            return def;
        };

        const parseFloatVal = (val, def = 1.0) => {
            if (val === undefined || val === null) return def;
            const n = parseFloat(val);
            return isNaN(n) ? def : n;
        };

        const parseIntVal = (val, def = 0) => {
            if (val === undefined || val === null) return def;
            const n = parseInt(val, 10);
            return isNaN(n) ? def : n;
        };

        const maskFileName = getTexName(findParam(['u_maskTexture', 'u_mask_texture', 'maskTexture', '_MaskTex'], `card_${folderId}_sticker_mask.png`), `card_${folderId}_sticker_mask.png`);
        const redTexName = getTexName(findParam(['u_red_blendTexture', 'u_red_texture', 'red_blendTexture', '_Red_BlendTexture'], 'ef_seamless_smoke4.png'), 'ef_seamless_smoke4.png');
        const greenTexName = getTexName(findParam(['u_green_blendTexture', 'u_green_texture', 'green_blendTexture', '_Green_BlendTexture'], 'ef_seamless_wave5.png'), 'ef_seamless_wave5.png');
        const blueTexName = getTexName(findParam(['u_blue_blendTexture', 'u_blue_texture', 'blue_blendTexture', '_Blue_BlendTexture'], 'card_black_only.png'), 'card_black_only.png');

        this.stickerConfig = {
            maskUrl: `${baseFolder}${maskFileName}`,
            maskFallback: `${baseFolder}card_${folderId}_sticker_mask.png`,
            red: {
                blendTextureUrl: `assets/special_sticker/general_texture/${redTexName}`,
                fallbackUrl: `${baseFolder}${redTexName}`,
                tiling: parseVec2(findParam(['u_red_tiling', 'red_tiling']), [2, 2]),
                offset: parseVec2(findParam(['u_red_offset', 'red_offset']), [0, 0]),
                blendType: parseIntVal(findParam(['u_red_blendType', 'red_blendType']), 0),
                color: parseVec3(findParam(['u_red_color', 'red_color']), [1, 0.77, 0.68]),
                intensity: parseFloatVal(findParam(['u_red_intensity', 'red_intensity']), 0.5),
                coordinateType: parseIntVal(findParam(['u_red_coordinateType', 'red_coordinateType']), 0),
                scrollVelocity: parseVec2(findParam(['u_red_scrollVelocity', 'red_scrollVelocity']), [0.0, 1.0]),
                rotateCenter: parseVec2(findParam(['u_red_rotateCenter', 'red_rotateCenter']), [0.5, 0.5]),
                rotateVelocity: parseFloatVal(findParam(['u_red_rotateVelocity', 'red_rotateVelocity']), 0.0)
            },
            green: {
                blendTextureUrl: `assets/special_sticker/general_texture/${greenTexName}`,
                fallbackUrl: `${baseFolder}${greenTexName}`,
                tiling: parseVec2(findParam(['u_green_tiling', 'green_tiling']), [0.5, 0.5]),
                offset: parseVec2(findParam(['u_green_offset', 'green_offset']), [-0.52, -0.39]),
                blendType: parseIntVal(findParam(['u_green_blendType', 'green_blendType']), 0),
                color: parseVec3(findParam(['u_green_color', 'green_color']), [0.78, 0.63, 0.95]),
                intensity: parseFloatVal(findParam(['u_green_intensity', 'green_intensity']), 0.8),
                coordinateType: parseIntVal(findParam(['u_green_coordinateType', 'green_coordinateType']), 1),
                scrollVelocity: parseVec2(findParam(['u_green_scrollVelocity', 'green_scrollVelocity']), [-1.0, 0.0]),
                rotateCenter: parseVec2(findParam(['u_green_rotateCenter', 'green_rotateCenter']), [0.5, 0.5]),
                rotateVelocity: parseFloatVal(findParam(['u_green_rotateVelocity', 'green_rotateVelocity']), 0.0)
            },
            blue: {
                blendTextureUrl: `assets/special_sticker/general_texture/${blueTexName}`,
                fallbackUrl: `${baseFolder}${blueTexName}`,
                tiling: parseVec2(findParam(['u_blue_tiling', 'blue_tiling']), [1, 1]),
                offset: parseVec2(findParam(['u_blue_offset', 'blue_offset']), [0, 0]),
                blendType: parseIntVal(findParam(['u_blue_blendType', 'blue_blendType']), 0),
                color: parseVec3(findParam(['u_blue_color', 'blue_color']), [0, 0, 0]),
                intensity: parseFloatVal(findParam(['u_blue_intensity', 'blue_intensity']), 0.0),
                coordinateType: parseIntVal(findParam(['u_blue_coordinateType', 'blue_coordinateType']), 0),
                scrollVelocity: parseVec2(findParam(['u_blue_scrollVelocity', 'blue_scrollVelocity']), [0.0, 0.0]),
                rotateCenter: parseVec2(findParam(['u_blue_rotateCenter', 'blue_rotateCenter']), [0.5, 0.5]),
                rotateVelocity: parseFloatVal(findParam(['u_blue_rotateVelocity', 'blue_rotateVelocity']), 0.0)
            }
        };

        return await this.initWebGL();
    }

    async initWebGL() {
        const gl = this.gl;
        if (!gl || !this.stickerConfig) return false;

        const vsSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            attribute vec4 a_color;

            uniform mat4 u_MVPMatrix;
            varying vec2 v_texCoord;
            varying vec4 v_color;

            void main() {
                v_texCoord = a_texCoord;
                v_color = a_color;
                gl_Position = u_MVPMatrix * vec4(a_position, 0.0, 1.0);
            }
        `;

        const fsSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            varying vec4 v_color;

            uniform sampler2D u_maskTexture;
            uniform sampler2D u_red_blendTexture;
            uniform sampler2D u_green_blendTexture;
            uniform sampler2D u_blue_blendTexture;

            uniform float u_time;

            uniform vec2 u_red_tiling;
            uniform vec2 u_red_offset;
            uniform vec3 u_red_color;
            uniform float u_red_intensity;
            uniform int u_red_coordinateType;
            uniform vec2 u_red_scrollVelocity;
            uniform vec2 u_red_rotateCenter;
            uniform float u_red_rotateVelocity;

            uniform vec2 u_green_tiling;
            uniform vec2 u_green_offset;
            uniform vec3 u_green_color;
            uniform float u_green_intensity;
            uniform int u_green_coordinateType;
            uniform vec2 u_green_scrollVelocity;
            uniform vec2 u_green_rotateCenter;
            uniform float u_green_rotateVelocity;

            uniform vec2 u_blue_tiling;
            uniform vec2 u_blue_offset;
            uniform vec3 u_blue_color;
            uniform float u_blue_intensity;
            uniform int u_blue_coordinateType;
            uniform vec2 u_blue_scrollVelocity;
            uniform vec2 u_blue_rotateCenter;
            uniform float u_blue_rotateVelocity;

            vec2 calcUV(vec2 uv, vec2 tiling, vec2 offset, int coordType, vec2 scrollVel, vec2 rotCenter, float rotVel, float time) {
                vec2 result = uv;
                if (coordType == 1) {
                    vec2 d = uv + offset;
                    float r = length(d) * 2.0;
                    float theta = atan(d.y, d.x) * 0.15915494309 + 0.5;
                    if (rotVel != 0.0) theta += rotVel * time;
                    result = vec2(r, theta); 
                    result = fract(result * tiling + scrollVel * time);
                } else {
                    if (rotVel != 0.0) {
                        float angle = rotVel * time;
                        float c = cos(angle);
                        float s = sin(angle);
                        mat2 rot = mat2(c, -s, s, c);
                        result = rot * (result - rotCenter) + rotCenter;
                    }
                    result = fract((result + offset) * tiling + scrollVel * time);
                }
                return result;
            }

            void main() {
                vec4 mask = texture2D(u_maskTexture, v_texCoord);

                float maskR = mask.r;
                float maskG = mask.g;
                float maskB = mask.b;

                if (mask.r > 0.7 && mask.g > 0.7 && mask.b > 0.7) {
                    maskR = 0.0;
                    maskG = 0.0;
                    maskB = 0.0;
                } else {
                    maskG = max(0.0, mask.g - mask.r * 0.8);
                    maskR = max(0.0, mask.r - mask.g * 0.8);
                    maskB = max(0.0, mask.b - max(mask.r, mask.g) * 0.8);
                }

                vec2 uvR = calcUV(v_texCoord, u_red_tiling, u_red_offset, u_red_coordinateType, u_red_scrollVelocity, u_red_rotateCenter, u_red_rotateVelocity, u_time);
                float sampleR = texture2D(u_red_blendTexture, uvR).r;
                vec3 colR = u_red_color * sampleR * maskR * u_red_intensity * 2.2;

                vec2 uvG = calcUV(v_texCoord, u_green_tiling, u_green_offset, u_green_coordinateType, u_green_scrollVelocity, u_green_rotateCenter, u_green_rotateVelocity, u_time);
                float sampleG = texture2D(u_green_blendTexture, uvG).r;
                vec3 colG = u_green_color * sampleG * maskG * u_green_intensity * 2.5;

                vec2 uvB = calcUV(v_texCoord, u_blue_tiling, u_blue_offset, u_blue_coordinateType, u_blue_scrollVelocity, u_blue_rotateCenter, u_blue_rotateVelocity, u_time);
                float sampleB = texture2D(u_blue_blendTexture, uvB).r;
                vec3 colB = u_blue_color * sampleB * maskB * u_blue_intensity;

                vec3 glowColor = colR + colG + colB;
                float finalAlpha = clamp(max(max(maskR * sampleR * u_red_intensity, maskG * sampleG * u_green_intensity), maskB * sampleB * u_blue_intensity), 0.0, 1.0);

                gl_FragColor = vec4(glowColor, finalAlpha * 0.95 * v_color.a);
            }
        `;

        const vs = this._createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fs = this._createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        if (!vs || !fs) return false;

        this.program = this._createProgram(gl, vs, fs);
        if (!this.program) return false;

        gl.useProgram(this.program);
        this._initQuad(gl, this.program);

        const [maskTex, redTex, greenTex, blueTex] = await Promise.all([
            this._loadTexture(this.stickerConfig.maskUrl, false) || this._loadTexture(this.stickerConfig.maskFallback, false),
            this._loadTexture(this.stickerConfig.red.blendTextureUrl, true) || this._loadTexture(this.stickerConfig.red.fallbackUrl, true),
            this._loadTexture(this.stickerConfig.green.blendTextureUrl, true) || this._loadTexture(this.stickerConfig.green.fallbackUrl, true),
            this._loadTexture(this.stickerConfig.blue.blendTextureUrl, true) || this._loadTexture(this.stickerConfig.blue.fallbackUrl, true)
        ]);

        if (!maskTex || !redTex || !greenTex || !blueTex) return false;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        this._bindSamplers(gl, this.program, { maskTex, redTex, greenTex, blueTex });

        const mvpLoc = gl.getUniformLocation(this.program, "u_MVPMatrix");
        if (mvpLoc) {
            const mvp = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
            gl.uniformMatrix4fv(mvpLoc, false, mvp);
        }

        this._setChannelUniforms(gl, this.program, this.stickerConfig);
        this.startTime = performance.now();
        this._renderLoop();
        return true;
    }

    _createShader(gl, type, src) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("[Sticker Error] Shader compile error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    _createProgram(gl, vs, fs) {
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("[Sticker Error] Program link error:", gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    _initQuad(gl, program) {
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
        const colors = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

        const posLoc = gl.getAttribLocation(program, "a_position");
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const texLoc = gl.getAttribLocation(program, "a_texCoord");
        const texBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

        const colLoc = gl.getAttribLocation(program, "a_color");
        const colBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(colLoc);
        gl.vertexAttribPointer(colLoc, 4, gl.FLOAT, false, 0, 0);
    }

    _bindSamplers(gl, program, samplers) {
        const uMask = gl.getUniformLocation(program, "u_maskTexture");
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, samplers.maskTex);
        gl.uniform1i(uMask, 1);

        const uRed = gl.getUniformLocation(program, "u_red_blendTexture");
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, samplers.redTex);
        gl.uniform1i(uRed, 2);

        const uGreen = gl.getUniformLocation(program, "u_green_blendTexture");
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, samplers.greenTex);
        gl.uniform1i(uGreen, 3);

        const uBlue = gl.getUniformLocation(program, "u_blue_blendTexture");
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, samplers.blueTex);
        gl.uniform1i(uBlue, 4);
    }

    _setChannelUniforms(gl, program, config) {
        const setVec2 = (name, val) => {
            const loc = gl.getUniformLocation(program, name);
            if (loc) gl.uniform2f(loc, val[0], val[1]);
        };
        const setVec3 = (name, val) => {
            const loc = gl.getUniformLocation(program, name);
            if (loc) gl.uniform3f(loc, val[0], val[1], val[2]);
        };
        const setFloat = (name, val) => {
            const loc = gl.getUniformLocation(program, name);
            if (loc) gl.uniform1f(loc, val);
        };
        const setInt = (name, val) => {
            const loc = gl.getUniformLocation(program, name);
            if (loc) gl.uniform1i(loc, val);
        };

        const applyChannel = (prefix, ch) => {
            const prop = (name) => `u_${prefix}_${name}`;
            setVec2(prop("tiling"), ch.tiling);
            setVec2(prop("offset"), ch.offset);
            setVec3(prop("color"), ch.color);
            setFloat(prop("intensity"), ch.intensity);
            setInt(prop("coordinateType"), ch.coordinateType);
            setVec2(prop("scrollVelocity"), ch.scrollVelocity);
            setVec2(prop("rotateCenter"), ch.rotateCenter);
            setFloat(prop("rotateVelocity"), ch.rotateVelocity);
        };

        applyChannel("red", config.red);
        applyChannel("green", config.green);
        applyChannel("blue", config.blue);
    }

    async _loadTexture(url, repeat = true) {
        const gl = this.gl;
        if (!url) return null;

        const candidateUrls = [
            url,
            `./${url}`,
            url.replace(/^assets\//, './assets/'),
            `https://images.weserv.nl/?url=dokkaninfo.com/${url.replace(/^(\.\/|\/)/, '')}`
        ];

        for (const testUrl of candidateUrls) {
            const tex = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const t = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, t);

                    const isPowerOf2 = (v) => (v & (v - 1)) === 0;
                    let source = img;

                    if (repeat && (!isPowerOf2(img.width) || !isPowerOf2(img.height))) {
                        const canvas = document.createElement('canvas');
                        canvas.width = 512;
                        canvas.height = 512;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, 512, 512);
                        source = canvas;
                    }

                    if (repeat) {
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                    } else {
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    }

                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
                    this.textures.push(t);
                    resolve(t);
                };
                img.onerror = () => resolve(null);
                img.src = testUrl;
            });

            if (tex) return tex;
        }

        return null;
    }

    _renderLoop = () => {
        if (!this.gl || !this.program) return;
        const gl = this.gl;
        gl.useProgram(this.program);

        const time = (performance.now() - this.startTime) / 1000.0;
        const timeLoc = gl.getUniformLocation(this.program, "u_time");
        if (timeLoc) gl.uniform1f(timeLoc, time);

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        this.animationFrameId = requestAnimationFrame(this._renderLoop);
    };
}

window.DokkanStickerRunner = DokkanStickerRunner;