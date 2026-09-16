/* Fluted Glass — adapted from Paper Shaders / 21st.dev, Apache-2.0.
   The supplied preset is used verbatim in a WebGL1 fullscreen triangle. */
(() => {
    'use strict';
    if (location.pathname.toLowerCase().endsWith('/editor.html')) return;

    const vertex = 'attribute vec2 p; void main(){gl_Position=vec4(p,0.,1.);}';
    const fragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 u_colors[8];
uniform vec4 u_scene,u_shape,u_surface,u_finish,u_transform,u_space,u_cursor;
#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_paramA u_shape.z
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
#define u_seed mod(u_transform.x,31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_oklab u_transform.w
#define u_offset u_space.xy
#define u_mouse u_space.zw
#define u_cursorPresence u_cursor.x
#define u_cursorEffect u_cursor.y
#define u_cursorStrength u_cursor.z
#define u_cursorRadius u_cursor.w
float hash21(vec2 p){
#ifndef GL_FRAGMENT_PRECISION_HIGH
p=mod(p,31.0);
#endif
p=fract(p*vec2(234.34,435.345));p+=dot(p,p+34.23);return fract(p.x*p.y);}
float grainHash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),u.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(17.,9.2);a*=.5;}return v;}
vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
vec3 linearToSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(.0031308,c));}
vec3 linToOklab(vec3 c){float l=.4122214708*c.r+.5363325363*c.g+.0514459929*c.b,m=.2119034982*c.r+.6806995451*c.g+.1073969566*c.b,s=.0883024619*c.r+.2817188376*c.g+.6299787005*c.b;l=pow(max(l,0.),1./3.);m=pow(max(m,0.),1./3.);s=pow(max(s,0.),1./3.);return vec3(.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+0.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s);}
vec3 oklabToLin(vec3 c){float l=c.x+.3963377774*c.y+.2158037573*c.z,m=c.x-.1055613458*c.y-.0638541728*c.z,s=c.x-.0894841775*c.y-1.291485548*c.z;l=l*l*l;m=m*m*m;s=s*s*s;return vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s);}
vec3 mixColour(vec3 a,vec3 b,float t){if(u_oklab>.5){vec3 la=linToOklab(srgbToLinear(a)),lb=linToOklab(srgbToLinear(b));return clamp(linearToSrgb(oklabToLin(mix(la,lb,t))),0.,1.);}return mix(a,b,t);}
vec3 palette(float x){float n=max(u_colorCount-1.,1.),f=clamp(x,0.,1.)*n;vec3 col=u_colors[0];for(int i=0;i<7;i++){if(float(i)<n)col=mixColour(col,u_colors[i+1],smoothstep(0.,1.,clamp(f-float(i),0.,1.)));}return col;}
vec3 hueRotate(vec3 col,float a){const mat3 yiq=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312),rgb=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);vec3 q=yiq*col;float ca=cos(a),sa=sin(a);q=vec3(q.x,q.y*ca-q.z*sa,q.y*sa+q.z*ca);return rgb*q;}
vec3 shade(vec2 p,float t){float flutes=mix(42.,7.,u_paramA),cell=fract((p.x+1.)*flutes)-.5,prism=sin(cell*3.1415926)*(.03+u_intensity*.2);vec2 sp=p+vec2(prism,sin(p.x*flutes+t*.2)*prism*.35);float field=fbm(sp*2.2+vec2(t*.035,-t*.025)+u_seed)+.24*sin(sp.y*3.+sp.x*1.3),highlight=pow(1.-abs(cell)*2.,mix(12.,2.,u_intensity)),shadow=smoothstep(.18,.5,abs(cell));return palette(clamp(field+highlight*.3,0.,1.))*(.94+highlight*.20-shadow*.04);}
void main(){vec2 uv=gl_FragCoord.xy/u_resolution,screenUv=uv,p=(gl_FragCoord.xy-.5*u_resolution)/min(u_resolution.x,u_resolution.y);p*=u_scale;if(abs(u_rotate)>.0001){float c=cos(u_rotate),s=sin(u_rotate);p=mat2(c,-s,s,c)*p;}p+=u_offset;if(u_drift>.0001)p+=u_drift*vec2(sin(u_time*.31),cos(u_time*.23));if(u_warp>0.)p+=u_warp*(vec2(fbm(p*u_detail+u_seed),fbm(p*u_detail+vec2(5.2,1.3)))-.5);vec3 col=shade(p,u_time);if(abs(u_contrast-1.)>.0001)col=(col-.5)*u_contrast+.5;if(abs(u_saturation-1.)>.0001){float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,u_saturation);}if(abs(u_hue)>.0001)col=hueRotate(col,u_hue);col+=u_brightness;if(u_vignette>.0001){float vd=length(screenUv-.5)*1.41421356;col*=1.-u_vignette*smoothstep(.35,1.,vd);}if(u_grain>.0001)col+=(grainHash(gl_FragCoord.xy+vec2(u_seed*17.,u_seed*31.))-.5)*u_grain;gl_FragColor=vec4(clamp(col,0.,1.),1.);}`;

    const mount = () => {
        const old = document.getElementById('fluted-glass-background');
        old?.remove();
        const canvas = document.createElement('canvas');
        canvas.id = 'fluted-glass-background'; canvas.className = 'fluted-glass-background'; canvas.setAttribute('aria-hidden', 'true');
        document.body.prepend(canvas);
        const overlay = document.querySelector('.fluted-glass-overlay') || Object.assign(document.createElement('div'), { className: 'fluted-glass-overlay' });
        if (!overlay.isConnected) canvas.insertAdjacentElement('afterend', overlay);
        let enabled = localStorage.getItem('fluted_glass_enabled') !== 'off', raf = 0;
        const controls = () => document.querySelectorAll('[data-fluted-glass-mode]').forEach(button => {
            const active = (button.dataset.flutedGlassMode === 'on') === enabled;
            button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
        });
        const apply = (value) => { enabled = value === true || value === 'on'; localStorage.setItem('fluted_glass_enabled', enabled ? 'on' : 'off'); document.body.classList.toggle('fluted-glass-disabled', !enabled); controls(); if (enabled) start(); else cancelAnimationFrame(raf); };
        window.setFlutedGlassEnabled = apply;
        document.body.classList.add('has-fluted-glass-background'); document.body.classList.toggle('fluted-glass-disabled', !enabled); controls();
        const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
        if (!gl) return;
        const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null; };
        const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
        if (!vs || !fs) return;
        const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'p');
        const uniform = name => gl.getUniformLocation(program, name);
        const colors = uniform('u_colors[0]'), scene = uniform('u_scene'), shape = uniform('u_shape'), surface = uniform('u_surface'), finish = uniform('u_finish'), transform = uniform('u_transform'), space = uniform('u_space'), cursor = uniform('u_cursor');
        const resize = () => { const ratio = Math.min(devicePixelRatio || 1, 2), width = Math.max(1, innerWidth * ratio | 0), height = Math.max(1, innerHeight * ratio | 0); if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; } };
        const draw = now => { if (document.hidden || !enabled) return; resize(); gl.viewport(0,0,canvas.width,canvas.height); gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0); gl.uniform3fv(colors,new Float32Array([.018,.018,.022,.10,.10,.12,.28,.28,.32,.62,.62,.68,0,0,0,0,0,0,0,0,0,0,0,0])); gl.uniform4f(scene,canvas.width,canvas.height,now/1000*1.07,4); gl.uniform4f(shape,1.70,.69,.74,.30); gl.uniform4f(surface,3.68,.91,-.01,.72); gl.uniform4f(finish,6.06,.18,.003,.06); gl.uniform4f(transform,8776,1.29,.10,1); gl.uniform4f(space,-.04,.16,0,0); gl.uniform4f(cursor,0,0,.75,.39); gl.drawArrays(gl.TRIANGLES,0,3); raf=requestAnimationFrame(draw); };
        const start = () => { cancelAnimationFrame(raf); if (!document.hidden && enabled) raf=requestAnimationFrame(draw); };
        document.addEventListener('visibilitychange', start); addEventListener('resize', resize, { passive: true }); start();
    };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
