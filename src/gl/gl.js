import {
  WebGLRenderer, Scene, PerspectiveCamera, PlaneGeometry, Mesh, ShaderMaterial,
  Vector2, Vector3, Quaternion, Color, Group, CanvasTexture, Texture, LinearFilter,
  LinearMipmapLinearFilter, NoColorSpace, Raycaster, BufferGeometry, Float32BufferAttribute,
  Points, AdditiveBlending, MeshBasicMaterial, MathUtils,
} from 'three';
import gsap from 'gsap';
import { ACCENTS } from '../data.js';

const FOV = 35;
const NOISE = /* glsl */ `
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.,0.)), c = hash(i + vec2(0.,1.)), d = hash(i + vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(a, b, u.x) + (c - a)*u.y*(1.-u.x) + (d - b)*u.x*u.y;
}`;

/* --------------------------------------------------------- image planes */

const IMG_VERT = /* glsl */ `
uniform float uVel; uniform float uStrength;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec3 p = position;
  p.z += sin(uv.y * 3.14159) * uVel * 38.0 * uStrength;
  p.x += (uv.y - 0.5) * uVel * 0.025 * uStrength;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const IMG_FRAG = /* glsl */ `
uniform sampler2D uTex; uniform vec2 uImage; uniform vec2 uPlane; uniform vec2 uMouse;
uniform float uTime; uniform float uVel; uniform float uHover; uniform float uReveal;
uniform float uParallax; uniform float uStrength;
varying vec2 vUv;
${NOISE}
vec2 cover(vec2 uv){
  float rp = uPlane.x / uPlane.y, ri = uImage.x / uImage.y;
  vec2 s = rp < ri ? vec2(rp / ri, 1.0) : vec2(1.0, ri / rp);
  return (uv - 0.5) * s + 0.5;
}
void main(){
  float zoom = 1.16 - 0.08 * uReveal;
  vec2 uv = vUv;
  uv.y += uParallax * 0.05;
  uv = (uv - 0.5) / zoom + 0.5;
  vec2 dm = vUv - uMouse; dm.x *= uPlane.x / uPlane.y;
  float d = length(dm);
  float rip = sin(d * 34.0 - uTime * 4.0) * exp(-d * 5.0);
  uv += normalize(dm + 1e-5) * rip * 0.012 * uHover * uStrength;
  uv = cover(uv);
  float sh = (0.0012 + abs(uVel) * 0.007 + uHover * 0.005 * exp(-d * 3.0)) * uStrength;
  vec3 col = vec3(texture2D(uTex, uv + vec2(sh, 0.0)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(sh, 0.0)).b);
  col *= 0.9 + 0.14 * uHover;
  float vig = smoothstep(1.15, 0.3, length(vUv - 0.5) * 1.3);
  col *= mix(0.7, 1.0, vig);
  col += (hash(vUv * uPlane + fract(uTime) * 91.0) - 0.5) * 0.08;
  float n = noise(vUv * vec2(5.0, 2.0) + uTime * 0.2);
  float e = uReveal * 1.2 - 0.12 + (n - 0.5) * 0.14;
  float m = smoothstep(vUv.y - 0.015, vUv.y + 0.015, e);
  float edge = smoothstep(0.03, 0.0, abs(vUv.y - e)) * step(uReveal, 0.999);
  col += vec3(edge * 0.9);
  gl_FragColor = vec4(col, max(m, edge));
}`;

class GLImage {
  constructor(engine, el, texture, strength = 1) {
    this.el = el;
    this.hover = 0;
    const img = texture.image;
    this.uniforms = {
      uTex: { value: texture },
      uImage: { value: new Vector2(img.naturalWidth || img.width, img.naturalHeight || img.height) },
      uPlane: { value: new Vector2(1, 1) },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uTime: { value: 0 }, uVel: { value: 0 }, uHover: { value: 0 },
      uReveal: { value: 0 }, uParallax: { value: 0 }, uStrength: { value: strength },
    };
    this.mesh = new Mesh(
      engine.imgGeo,
      new ShaderMaterial({ vertexShader: IMG_VERT, fragmentShader: IMG_FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false }),
    );
    this.mesh.renderOrder = 1;
    engine.scene.add(this.mesh);
  }
  update(w, h, mouse, vel, time) {
    const r = this.el.getBoundingClientRect();
    const u = this.uniforms;
    const vis = r.bottom > -80 && r.top < h + 80 && r.width > 2;
    this.mesh.visible = vis && u.uReveal.value > 0.001;
    if (!vis) return;
    this.mesh.position.set(r.left + r.width / 2 - w / 2, -(r.top + r.height / 2 - h / 2), 0);
    this.mesh.scale.set(r.width, r.height, 1);
    u.uPlane.value.set(r.width, r.height);
    const inside = mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
    this.hover += ((inside ? 1 : 0) - this.hover) * 0.06;
    u.uHover.value = this.hover;
    const mx = (mouse.x - r.left) / r.width, my = 1 - (mouse.y - r.top) / r.height;
    u.uMouse.value.x += (mx - u.uMouse.value.x) * 0.12;
    u.uMouse.value.y += (my - u.uMouse.value.y) * 0.12;
    u.uParallax.value = (r.top + r.height / 2 - h / 2) / h;
    u.uVel.value = vel;
    u.uTime.value = time;
  }
}

/* ---------------------------------------------------------------- ring */

const CARD_VERT = /* glsl */ `
uniform float uVel; uniform float uHover;
varying vec2 vUv; varying float vDepth;
void main(){
  vUv = uv;
  vec3 p = position;
  p.z += sin(uv.y * 3.14159) * uVel * 15.0;
  p.y += sin(uv.x * 3.14159) * uVel * 4.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const CARD_FRAG = /* glsl */ `
uniform sampler2D uTex; uniform vec3 uAccent; uniform vec2 uSize;
uniform float uTime; uniform float uVel; uniform float uHover; uniform float uActive;
uniform float uOpacity; uniform float uFogNear; uniform float uFogFar; uniform float uDim;
varying vec2 vUv; varying float vDepth;
${NOISE}
void main(){
  vec3 col;
  if (gl_FrontFacing) {
    float sh = clamp(abs(uVel), 0.0, 2.5) * 0.0038 + uHover * 0.002;
    col = vec3(texture2D(uTex, vUv + vec2(sh, 0.0)).r, texture2D(uTex, vUv).g, texture2D(uTex, vUv - vec2(sh, 0.0)).b);
    float sweep = smoothstep(0.08, 0.0, abs(vUv.x + vUv.y * 0.35 - fract(uTime * 0.18) * 2.2 + 0.4));
    col += vec3(sweep * 0.1 * (0.4 + uHover));
  } else {
    col = texture2D(uTex, vec2(1.0 - vUv.x, vUv.y)).rgb * 0.12 + vec3(0.02);
  }
  vec2 px = vUv * uSize;
  float b = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
  float border = 1.0 - smoothstep(0.0, 1.6, b);
  vec3 bc = mix(vec3(0.28), uAccent, clamp(uHover + uActive * 0.55, 0.0, 1.0));
  col = mix(col, bc, border);
  col *= 0.78 + 0.26 * uHover + 0.08 * uActive;
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, vec3(0.0), fog * 0.86);
  col *= 1.0 - uDim;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * 0.035;
  gl_FragColor = vec4(col, uOpacity);
}`;

class Ring {
  constructor(engine, canvases, projects, stageEl) {
    this.engine = engine;
    this.n = canvases.length;
    this.step = (Math.PI * 2) / this.n;
    this.stageEl = stageEl;
    this.projects = projects;
    this.pivot = new Group();
    this.spinner = new Group();
    this.pivot.add(this.spinner);
    engine.scene.add(this.pivot);

    this.scrollRot = 0; this.dragOffset = 0; this.rot = 0; this.prev = 0; this.vel = 0;
    this.snap = 0; this.dragging = false; this.dragVX = 0; this.vis = 0;
    this.hovered = -1; this.active = 0; this.locked = false; this.focusIndex = -1;
    this.onActive = () => {};

    this.textures = canvases.map((c) => {
      const t = new CanvasTexture(c);
      t.colorSpace = NoColorSpace;
      t.anisotropy = engine.renderer.capabilities.getMaxAnisotropy();
      t.minFilter = LinearMipmapLinearFilter;
      return t;
    });
    this.meshes = this.textures.map((tex, i) => {
      const accent = new Color(ACCENTS[projects[i].tone]);
      const m = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
        vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, transparent: true, side: 2,
        uniforms: {
          uTex: { value: tex }, uAccent: { value: new Vector3(accent.r, accent.g, accent.b) },
          uSize: { value: new Vector2(1, 1) }, uTime: { value: 0 }, uVel: { value: 0 },
          uHover: { value: 0 }, uActive: { value: 0 }, uOpacity: { value: 1 },
          uFogNear: { value: 0 }, uFogFar: { value: 1 }, uDim: { value: 0 },
        },
      }));
      m.userData = { index: i, hover: 0, active: 0 };
      this.spinner.add(m);
      return m;
    });
    this.raycaster = new Raycaster();
  }

  layout(w, h) {
    const mobile = w < 760;
    this.cardW = mobile ? Math.min(w * 0.6, h * 0.34) : Math.min(h * 0.34, 330);
    this.cardH = this.cardW / 0.72;
    const R = (this.R = (this.n * this.cardW * 1.16) / (Math.PI * 2));
    const geo = new PlaneGeometry(this.cardW, this.cardH, 36, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const a = x / R;
      pos.setX(i, R * Math.sin(a));
      pos.setZ(i, R * Math.cos(a) - R);
    }
    geo.computeVertexNormals();
    this.meshes.forEach((m, i) => {
      if (m.geometry) m.geometry.dispose();
      m.geometry = geo;
      const th = i * this.step;
      m.position.set(R * Math.sin(th), 0, R * Math.cos(th));
      m.rotation.y = th;
      const u = m.material.uniforms;
      u.uSize.value.set(this.cardW, this.cardH);
      u.uFogNear.value = this.engine.camZ + R * 0.15;
      u.uFogFar.value = this.engine.camZ + R * 1.9;
    });
    this.tilt = mobile ? 0.14 : 0.2;
    this.pivot.rotation.x = this.tilt;
  }

  setScroll(p) { this.scrollRot = -p * (this.n - 1) * this.step; }

  dragStart() { this.dragging = true; this.dragVX = 0; }
  dragMove(dx) {
    const k = (this.step / this.cardW) * 1.1;
    this.dragOffset += dx * k;
    this.dragVX = dx * k;
  }
  dragEnd() { this.dragging = false; this.dragOffset += this.dragVX * 8; }

  angleOf(i) { return i * this.step + this.rot; }

  rotateTo(i) {
    // shortest rotation that brings card i to the front
    const raw = this.scrollRot + this.dragOffset;
    let want = -i * this.step;
    const k = Math.round((raw - want) / (Math.PI * 2));
    want += k * Math.PI * 2;
    this.dragOffset += want - raw;
  }

  hit(ndc) {
    if (this.vis < 0.6 || this.locked) return -1;
    this.raycaster.setFromCamera(ndc, this.engine.camera);
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    for (const h of hits) {
      const i = h.object.userData.index;
      if (Math.cos(this.angleOf(i)) > 0.35) return i;
    }
    return -1;
  }

  update(dt, time, w, h, scrollVel, mouseN) {
    const r = this.stageEl.getBoundingClientRect();
    const enter = MathUtils.clamp(1 - r.top / h, 0, 1);
    const exit = MathUtils.clamp(r.bottom / h, 0, 1);
    const v = Math.min(enter, exit);
    this.vis += (v - this.vis) * Math.min(1, dt * 8);
    const e = this.vis * this.vis * (3 - 2 * this.vis);
    this.pivot.visible = this.vis > 0.003;
    if (!this.pivot.visible) return;

    const raw = this.scrollRot + this.dragOffset;
    const snapT = Math.round(raw / this.step) * this.step;
    const idle = !this.dragging && Math.abs(scrollVel) < 0.2 ? 1 : 0;
    this.snap += (idle - this.snap) * Math.min(1, dt * 2.5);
    const target = raw + (snapT - raw) * this.snap * 0.92;
    this.rot += (target - this.rot) * (1 - Math.exp(-dt * 6.5));
    this.vel = MathUtils.lerp(this.vel, (this.rot - this.prev) / Math.max(dt, 1e-3), 0.2);
    this.prev = this.rot;
    this.spinner.rotation.y = this.rot;

    this.pivot.position.set(0, -r.top + this.R * Math.sin(this.tilt) * 0.95, -this.R);
    this.pivot.rotation.x = this.tilt + mouseN.y * 0.03 + (1 - e) * 0.35;
    this.pivot.rotation.z = -mouseN.x * 0.02;
    const s = 0.82 + 0.18 * e;
    this.pivot.scale.setScalar(s);

    const act = ((Math.round(-this.rot / this.step) % this.n) + this.n) % this.n;
    if (act !== this.active) { this.active = act; this.onActive(act); }

    const vel = MathUtils.clamp(this.vel, -4, 4);
    this.meshes.forEach((m, i) => {
      const u = m.material.uniforms;
      const d = m.userData;
      d.hover += ((i === this.hovered ? 1 : 0) - d.hover) * Math.min(1, dt * 9);
      d.active += ((i === this.active ? 1 : 0) - d.active) * Math.min(1, dt * 6);
      u.uHover.value = d.hover;
      u.uActive.value = d.active;
      u.uVel.value = vel;
      u.uTime.value = time;
      const focusHide = i === this.focusIndex ? 0 : 1;
      u.uOpacity.value = e * focusHide;
      m.scale.setScalar(1 + d.hover * 0.045);
    });
  }

  setDim(v) { this.meshes.forEach((m) => (m.material.uniforms.uDim.value = v)); }

  worldTransform(i) {
    const m = this.meshes[i];
    m.updateWorldMatrix(true, false);
    const p = new Vector3(), q = new Quaternion(), s = new Vector3();
    m.matrixWorld.decompose(p, q, s);
    // the bent card's visual centre sits slightly behind its origin
    return { p, q, s: s.x };
  }
}

/* ---------------------------------------------------------------- focus */

const FOCUS_FRAG = /* glsl */ `
uniform sampler2D uTex; uniform sampler2D uTex2; uniform float uMix; uniform float uTime; uniform float uOpacity;
uniform vec2 uSize;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 uv = vUv;
  float g = sin(uMix * 3.14159);
  float band = step(0.55, noise(vec2(uv.y * 18.0, uTime * 6.0))) * g;
  uv.x += band * 0.05 * (hash(vec2(floor(uv.y * 30.0), uTime)) - 0.5);
  vec3 a = texture2D(uTex, uv).rgb;
  vec3 b = texture2D(uTex2, uv + vec2(g * 0.01, 0.0)).rgb;
  vec3 col = mix(a, b, smoothstep(0.35, 0.65, uMix));
  vec2 px = vUv * uSize;
  float bd = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
  col = mix(col, vec3(0.35), 1.0 - smoothstep(0.0, 1.5, bd));
  col += (hash(gl_FragCoord.xy + fract(uTime) * 33.0) - 0.5) * 0.03;
  gl_FragColor = vec4(col, uOpacity);
}`;

/* ------------------------------------------------------------ particles */

function makeParticles(count, w, h) {
  const g = new BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * w * 2.2;
    pos[i * 3 + 1] = (Math.random() - 0.5) * h * 3;
    pos[i * 3 + 2] = -1800 + Math.random() * 2000;
    seed[i] = Math.random();
  }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uScroll: { value: 0 }, uTime: { value: 0 }, uRange: { value: h * 3 }, uCamZ: { value: 1000 }, uVel: { value: 0 }, uPR: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uScroll; uniform float uTime; uniform float uRange; uniform float uCamZ; uniform float uVel; uniform float uPR;
      varying float vA;
      void main(){
        vec3 p = position;
        float depth = (p.z + 1800.0) / 2000.0;
        p.y = mod(p.y + uScroll * (0.15 + depth * 0.5) + uTime * (6.0 + aSeed * 10.0) + uRange * 0.5, uRange) - uRange * 0.5;
        p.x += sin(uTime * 0.3 + aSeed * 30.0) * 18.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPR * (1.2 + aSeed * 2.2) * (uCamZ / -mv.z) * (1.0 + abs(uVel) * 1.5);
        vA = (0.18 + aSeed * 0.5) * (0.4 + depth);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(vec3(0.95, 0.93, 0.9), a);
      }`,
  });
  return new Points(g, mat);
}

/* --------------------------------------------------------------- engine */

export function createEngine(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = 'srgb-linear';

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 10, 12000);
  const engine = {
    renderer, scene, camera, camZ: 1000, w: 1, h: 1,
    imgGeo: new PlaneGeometry(1, 1, 24, 24),
    images: [], ring: null, particles: null,
    mouse: { x: -9999, y: -9999 }, mouseN: new Vector2(), ndc: new Vector2(),
    scrollVel: 0, scrollY: 0, focus: null,
  };

  engine.resize = () => {
    const w = (engine.w = window.innerWidth);
    const h = (engine.h = window.innerHeight);
    const pr = Math.min(window.devicePixelRatio || 1, w < 760 ? 1.6 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    engine.camZ = h / 2 / Math.tan(MathUtils.degToRad(FOV / 2));
    camera.position.set(0, 0, engine.camZ);
    camera.updateProjectionMatrix();
    if (engine.ring) engine.ring.layout(w, h);
    if (engine.particles) {
      engine.particles.material.uniforms.uCamZ.value = engine.camZ;
      engine.particles.material.uniforms.uRange.value = h * 3;
      engine.particles.material.uniforms.uPR.value = pr;
    }
    if (engine.backdrop) engine.backdrop.scale.set(w * 1.3, h * 1.3, 1);
  };

  engine.addImage = (el, image, strength) => {
    const t = new Texture(image);
    t.colorSpace = NoColorSpace;
    t.minFilter = LinearFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    const gi = new GLImage(engine, el, t, strength);
    engine.images.push(gi);
    el.classList.add('is-gl');
    return gi;
  };

  engine.addRing = (canvases, projects, stageEl) => {
    engine.ring = new Ring(engine, canvases, projects, stageEl);
    engine.ring.layout(engine.w, engine.h);
    return engine.ring;
  };

  engine.addParticles = () => {
    const count = window.innerWidth < 760 ? 220 : 520;
    engine.particles = makeParticles(count, window.innerWidth, window.innerHeight);
    engine.particles.renderOrder = 0;
    scene.add(engine.particles);
    engine.resize();
  };

  // backdrop + focus plane for the project transition
  engine.backdrop = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  engine.backdrop.position.z = 1;
  engine.backdrop.renderOrder = 10;
  engine.backdrop.visible = false;
  scene.add(engine.backdrop);

  const focusU = {
    uTex: { value: null }, uTex2: { value: null }, uMix: { value: 0 }, uTime: { value: 0 },
    uOpacity: { value: 1 }, uSize: { value: new Vector2(1, 1) },
  };
  engine.focusMesh = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: FOCUS_FRAG, uniforms: focusU, transparent: true, depthTest: false, depthWrite: false,
  }));
  engine.focusMesh.renderOrder = 11;
  engine.focusMesh.visible = false;
  scene.add(engine.focusMesh);

  const rectToWorld = (r) => ({
    x: r.left + r.width / 2 - engine.w / 2,
    y: -(r.top + r.height / 2 - engine.h / 2),
    sx: r.width, sy: r.height,
  });

  let follow = null; // returns a DOMRect while the detail view is open
  let followMix = 0;

  engine.openFocus = (i, getRect, reduced) => new Promise((resolve) => {
    const ring = engine.ring;
    const fm = engine.focusMesh;
    const { p, q, s } = ring.worldTransform(i);
    ring.locked = true;
    ring.focusIndex = i;
    fm.position.set(p.x, p.y, 2);
    fm.quaternion.copy(q);
    fm.scale.set(ring.cardW * s, ring.cardH * s, 1);
    focusU.uTex.value = ring.textures[i];
    focusU.uTex2.value = ring.textures[i];
    focusU.uMix.value = 0;
    focusU.uOpacity.value = 1;
    fm.visible = true;
    engine.backdrop.visible = true;
    follow = getRect;
    followMix = 0;
    const state = { t: 0 };
    const from = { p: fm.position.clone(), q: fm.quaternion.clone(), sx: fm.scale.x, sy: fm.scale.y };
    engine._focusAnim = { from, state };
    const d = reduced ? 0.01 : 1.25;
    gsap.to(engine.backdrop.material, { opacity: 0.965, duration: reduced ? 0.01 : 0.9, ease: 'power2.inOut' });
    gsap.to(state, {
      t: 1, duration: d, ease: 'expo.inOut',
      onUpdate: () => { followMix = state.t; },
      onComplete: resolve,
    });
  });

  engine.swapFocus = (i) => {
    const ring = engine.ring;
    focusU.uTex2.value = ring.textures[i];
    focusU.uMix.value = 0;
    gsap.to(focusU.uMix, {
      value: 1, duration: 0.9, ease: 'power2.inOut',
      onComplete: () => { focusU.uTex.value = ring.textures[i]; focusU.uMix.value = 0; },
    });
    ring.focusIndex = i;
  };

  engine.closeFocus = (i, reduced) => new Promise((resolve) => {
    const ring = engine.ring;
    const fm = engine.focusMesh;
    const target = ring.worldTransform(i);
    const start = { p: fm.position.clone(), q: fm.quaternion.clone(), sx: fm.scale.x, sy: fm.scale.y };
    follow = null;
    const st = { t: 0 };
    gsap.to(engine.backdrop.material, { opacity: 0, duration: reduced ? 0.01 : 0.9, ease: 'power2.inOut', delay: reduced ? 0 : 0.2 });
    gsap.to(st, {
      t: 1, duration: reduced ? 0.01 : 1.1, ease: 'expo.inOut',
      onUpdate: () => {
        const t = st.t;
        fm.position.lerpVectors(start.p, new Vector3(target.p.x, target.p.y, 2), t);
        fm.quaternion.slerpQuaternions(start.q, target.q, t);
        fm.scale.set(MathUtils.lerp(start.sx, ring.cardW * target.s, t), MathUtils.lerp(start.sy, ring.cardH * target.s, t), 1);
      },
      onComplete: () => {
        fm.visible = false;
        engine.backdrop.visible = false;
        ring.focusIndex = -1;
        ring.locked = false;
        resolve();
      },
    });
  });

  const tmpQ = new Quaternion();
  const tmpP = new Vector3();
  engine.tick = (time, dt) => {
    const { w, h, mouse } = engine;
    engine.mouseN.set((mouse.x / w) * 2 - 1, -(mouse.y / h) * 2 + 1);
    if (mouse.x < -9000) engine.mouseN.set(0, 0);
    const vel = MathUtils.clamp(engine.scrollVel / 60, -1.6, 1.6);
    for (const im of engine.images) im.update(w, h, mouse, vel, time);
    if (engine.ring) engine.ring.update(dt, time, w, h, engine.scrollVel, engine.mouseN);
    if (engine.particles) {
      const u = engine.particles.material.uniforms;
      u.uScroll.value = engine.scrollY;
      u.uTime.value = time;
      u.uVel.value = vel;
    }
    focusU.uTime.value = time;
    if (engine.focusMesh.visible && follow && engine._focusAnim) {
      const r = follow();
      const tw = rectToWorld(r);
      const { from } = engine._focusAnim;
      const t = followMix;
      tmpP.set(tw.x, tw.y, 2);
      engine.focusMesh.position.lerpVectors(from.p, tmpP, t);
      tmpQ.identity();
      engine.focusMesh.quaternion.slerpQuaternions(from.q, tmpQ, t);
      engine.focusMesh.scale.set(MathUtils.lerp(from.sx, tw.sx, t), MathUtils.lerp(from.sy, tw.sy, t), 1);
      focusU.uSize.value.set(engine.focusMesh.scale.x, engine.focusMesh.scale.y);
    }
    renderer.render(scene, camera);
  };

  engine.resize();
  return engine;
}
