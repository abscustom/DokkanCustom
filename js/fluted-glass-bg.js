/*
 * Monochrome Fluted Glass background.
 * Adapted from Paper Shaders' Fluted Glass (Apache-2.0):
 * https://shaders.paper.design/fluted-glass
 *
 * This version is intentionally pointer-free: it has no mouse uniforms or
 * event listeners, so it remains a calm, animated background on every page.
 */
(() => {
    'use strict';

    if (window.location.pathname.toLowerCase().endsWith('/editor.html')) return;

    const vertexSource = `
        attribute vec2 a_position;
        void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
    `;

    const fragmentSource = `
        precision mediump float;
        uniform vec2 u_resolution;
        uniform float u_time;

        void main() {
            vec2 resolution = max(u_resolution, vec2(1.0));
            vec2 uv = gl_FragCoord.xy / resolution;
            float motion = u_time * 0.22;
            // Paper Shaders-inspired fluting: soft, refracted vertical glass
            // ribs with a slow independent wave so there is no mouse effect.
            float warp = sin(uv.y * 8.0 + motion) * 0.022
                + sin(uv.y * 3.0 - motion * 0.7) * 0.014;
            float rib = 0.5 + 0.5 * sin((uv.x + warp) * 92.0);
            rib = smoothstep(0.12, 0.94, rib);
            float sheen = 0.5 + 0.5 * sin((uv.x + warp * 1.7) * 46.0 + uv.y * 3.0 - motion);
            float vignette = 1.0 - 0.38 * smoothstep(0.15, 0.9, length(uv - 0.5) * 1.4142);
            float luminance = (0.16 + rib * 0.54 + sheen * 0.10) * vignette;
            gl_FragColor = vec4(vec3(luminance), 1.0);
        }
    `;

    const compile = (gl, type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const mount = () => {
        if (document.getElementById('fluted-glass-background')) return;
        const canvas = document.createElement('canvas');
        canvas.id = 'fluted-glass-background';
        canvas.className = 'fluted-glass-background';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.prepend(canvas);

        if (!document.querySelector('.glass-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'fluted-glass-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            canvas.insertAdjacentElement('afterend', overlay);
        }

        let enabled = localStorage.getItem('fluted_glass_enabled') !== 'off';
        let syncPlayback = () => {};
        const syncControls = () => {
            document.querySelectorAll('[data-fluted-glass-mode]').forEach((button) => {
                const isActive = (button.dataset.flutedGlassMode === 'on') === enabled;
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', String(isActive));
            });
        };
        window.setFlutedGlassEnabled = (value) => {
            enabled = value === true || value === 'on';
            localStorage.setItem('fluted_glass_enabled', enabled ? 'on' : 'off');
            document.body.classList.toggle('fluted-glass-disabled', !enabled);
            syncControls();
            syncPlayback();
        };
        document.body.classList.add('has-fluted-glass-background');
        document.body.classList.toggle('fluted-glass-disabled', !enabled);
        syncControls();

        const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
        if (!gl) {
            document.body.classList.add('fluted-glass-fallback');
            return;
        }

        const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
        const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
        if (!vertex || !fragment) return;
        const program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'a_position');
        const resolution = gl.getUniformLocation(program, 'u_resolution');
        const time = gl.getUniformLocation(program, 'u_time');
        let frameId = 0;
        let startedAt = performance.now();

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.max(1, Math.floor(window.innerWidth * dpr));
            const height = Math.max(1, Math.floor(window.innerHeight * dpr));
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
        };

        const render = (now) => {
            if (document.hidden || !enabled) return;
            resize();
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(resolution, canvas.width, canvas.height);
            gl.uniform1f(time, (now - startedAt) / 1000);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            frameId = requestAnimationFrame(render);
        };

        syncPlayback = () => {
            cancelAnimationFrame(frameId);
            if (!document.hidden && enabled) {
                startedAt = performance.now();
                frameId = requestAnimationFrame(render);
            }
        };

        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', syncPlayback);
        syncPlayback();
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
})();
