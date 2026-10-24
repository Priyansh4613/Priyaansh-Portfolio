import './style.css';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PROJECTS, ACCENTS, PROFILE } from './data.js';
import { drawCard, CARD_W, CARD_H } from './gl/cards.js';
import { createEngine } from './gl/gl.js';
import { pipelineHTML, STEPS } from './pipeline.js';
import resumeUrl from './assets/Priyansh_Chaudhary_Resume.pdf?url';
import airportUrl from './assets/img/airport.webp';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const N = PROJECTS.length;

let lenis;
let engine = null;
let ring = null;
let canvases = [];
const state = { open: false, busy: false, current: 0, listOpen: false, opener: null };

/* ------------------------------------------------------------ helpers */

const loadImage = (src) =>
  new Promise((res, rej) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

const waitFor = (cond, timeout = 1200) =>
  new Promise((res) => {
    const t0 = performance.now();
    const loop = () => (cond() || performance.now() - t0 > timeout ? res() : requestAnimationFrame(loop));
    loop();
  });

function cloneCanvas(src, w = src.width, h = src.height) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(src, 0, 0, w, h);
  return c;
}

function splitChars() {
  $$('[data-split]').forEach((el) => {
    const t = el.textContent;
    el.textContent = '';
    [...t].forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      el.append(s);
    });
  });
}

function fitHero() {
  const h = $('.hero-name');
  const prev = h.style.getPropertyValue('--wd');
  h.style.removeProperty('--wd');
  h.style.fontSize = '';
  const avail = h.clientWidth;
  const widest = Math.max(...$$('.hero-name .word').map((w) => w.getBoundingClientRect().width));
  const size = parseFloat(getComputedStyle(h).fontSize);
  if (widest > avail * 0.995) h.style.fontSize = `${Math.floor((size * avail * 0.98) / widest)}px`;
  if (prev) h.style.setProperty('--wd', prev);
}

function splitWords() {
  $$('[data-words]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  });
}

function grain() {
  const c = document.createElement('canvas');
  c.width = c.height = 180;
  const ctx = c.getContext('2d');
  const d = ctx.createImageData(180, 180);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  ctx.putImageData(d, 0, 0);
  $('.grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

function clock() {
  const el = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const tick = () => (el.textContent = fmt.format(new Date()));
  tick();
  setInterval(tick, 15000);
}

function scramble(el) {
  const text = el.dataset.text || (el.dataset.text = el.textContent);
  if (!el.style.minWidth) el.style.minWidth = `${el.offsetWidth}px`;
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+';
  let f = 0;
  const total = 12;
  cancelAnimationFrame(el._raf);
  const run = () => {
    el.textContent = [...text].map((c, i) => (i < (f / total) * text.length ? c : pool[(Math.random() * pool.length) | 0])).join('');
    if (++f <= total) el._raf = requestAnimationFrame(run);
    else el.textContent = text;
  };
  run();
}

/* --------------------------------------------------------------- cursor */

const cursor = { mode: '', setMode() {} };
function initCursor() {
  const root = $('.cursor');
  if (coarse) { root.remove(); return; }
  const dot = $('.cursor-dot');
  const ringEl = $('.cursor-ring');
  const label = $('.cursor-label');
  const p = { x: innerWidth / 2, y: innerHeight / 2 };
  const r = { ...p };
  window.addEventListener('pointermove', (e) => { p.x = e.clientX; p.y = e.clientY; root.classList.add('is-on'); });
  document.addEventListener('pointerleave', () => root.classList.remove('is-on'));
  gsap.ticker.add(() => {
    r.x += (p.x - r.x) * 0.2;
    r.y += (p.y - r.y) * 0.2;
    dot.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    ringEl.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
  });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, [data-hover]');
    root.classList.toggle('is-link', !!t);
  });
  cursor.setMode = (mode, text = '') => {
    if (cursor.mode === mode) return;
    cursor.mode = mode;
    root.dataset.mode = mode;
    label.textContent = text;
  };
}

/* ------------------------------------------------------------- loader */

async function boot() {
  html.classList.add('is-loading');
  $('#resumeLink').href = resumeUrl;
  splitChars();
  splitWords();
  grain();
  clock();
  initCursor();
  $('#archPipe').innerHTML = pipelineHTML();

  lenis = new Lenis({ duration: 1.15, smoothWheel: !reduced, touchMultiplier: 1.3 });
  lenis.stop();
  lenis.on('scroll', (e) => {
    ScrollTrigger.update();
    if (engine) {
      engine.scrollVel = e.velocity;
      engine.scrollY = e.scroll;
    }
  });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.scrollTo(0, 0);

  // progress counter
  const prog = { v: 0 };
  const upd = () => {
    $('#loadCount').textContent = Math.round(prog.v);
    $('#loadBar').style.transform = `scaleX(${prog.v / 100})`;
  };
  const figs = $$('[data-gl]');
  const tasks = [
    document.fonts.load('900 60px "Archivo X"'),
    document.fonts.load('500 20px "Archivo X"'),
    document.fonts.load('900 60px "Archivo X"', '₹'),
    loadImage(airportUrl),
    ...figs.map((f) => loadImage($('img', f).src)),
  ];
  let done = 0;
  tasks.forEach((t) =>
    t.catch(() => null).finally(() => {
      done++;
      gsap.to(prog, { v: (done / tasks.length) * 92, duration: 0.5, ease: 'power2.out', onUpdate: upd, overwrite: true });
    }),
  );
  const t0 = performance.now();
  const results = await Promise.allSettled(tasks);
  await document.fonts.ready;
  const airport = results[3].status === 'fulfilled' ? results[3].value : null;
  const figImgs = results.slice(4).map((r) => (r.status === 'fulfilled' ? r.value : null));

  canvases = PROJECTS.map((p) => drawCard(p, { airport }));

  try {
    engine = createEngine($('#gl'));
  } catch (err) {
    console.warn('WebGL unavailable, using the flat layout.', err);
    engine = null;
  }

  if (engine) {
    figs.forEach((f, i) => {
      if (figImgs[i]) f._gl = engine.addImage(f, figImgs[i], parseFloat(f.dataset.gl) || 1);
    });
    ring = engine.addRing(canvases, PROJECTS, $('#workStage'));
    ring.onActive = setActive;
    engine.addParticles();
    gsap.ticker.add((time, dt) => engine.tick(time, Math.min(dt / 1000, 0.05)));
    window.addEventListener('pointermove', (e) => { engine.mouse.x = e.clientX; engine.mouse.y = e.clientY; });
  } else {
    flatFallback();
  }

  buildList();
  bindDetail();
  bindRing();
  bindMisc();
  setActive(0);
  fitHero();
  setupScroll();

  const wait = Math.max(0, 1300 - (performance.now() - t0));
  await new Promise((r) => setTimeout(r, wait));
  await gsap.to(prog, { v: 100, duration: 0.45, ease: 'power2.out', onUpdate: upd, overwrite: true });
  intro();

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      engine?.resize();
      fitHero();
      ScrollTrigger.refresh();
      fitTitle();
    }, 160);
  });
}

function intro() {
  const hero = $('.hero-portrait')._gl;
  const tl = gsap.timeline({
    defaults: { ease: 'expo.out' },
    onComplete: () => {
      html.classList.remove('is-loading');
      $('#loader').remove();
      lenis.start();
    },
  });
  tl.to('.loader-name span', { yPercent: -120, duration: 0.7, stagger: 0.06, ease: 'expo.in' })
    .to('.loader-foot, .loader-bar', { autoAlpha: 0, duration: 0.3 }, '<')
    .to('#loader', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
    .from('.hero-name .ch', { yPercent: 118, duration: 1.4, stagger: 0.03 }, '-=0.55');
  if (hero) tl.to(hero.uniforms.uReveal, { value: 1, duration: 2, ease: 'power3.inOut' }, '<0.05');
  else tl.from('.hero-portrait', { clipPath: 'inset(100% 0 0 0)', duration: 1.6, ease: 'expo.inOut' }, '<0.05');
  tl.from('[data-hero-fade]', { autoAlpha: 0, y: 26, duration: 1.1, stagger: 0.08 }, '<0.6')
    .from('.nav', { autoAlpha: 0, y: -16, duration: 1 }, '<');
}

/* --------------------------------------------------------------- scroll */

function setupScroll() {
  // hero name compresses on the width axis as you leave
  const wd0 = getComputedStyle($('.hero-name')).getPropertyValue('--wd').trim() || '125%';
  gsap.fromTo('.hero-name', { '--wd': wd0 }, {
    '--wd': '66%', yPercent: -14, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero-portrait', {
    yPercent: 14, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  // intro words light up as you read
  gsap.fromTo('.intro-text .w', { opacity: 0.13 }, {
    opacity: 1, stagger: 0.12, ease: 'none',
    scrollTrigger: { trigger: '.intro-text', start: 'top 82%', end: 'bottom 40%', scrub: true },
  });

  // image reveals
  $$('[data-gl]').forEach((f) => {
    if (f.classList.contains('hero-portrait')) return;
    ScrollTrigger.create({
      trigger: f, start: 'top 88%', once: true,
      onEnter: () => {
        if (f._gl) gsap.to(f._gl.uniforms.uReveal, { value: 1, duration: reduced ? 0.01 : 1.8, ease: 'power2.inOut' });
        else f.classList.add('is-in');
      },
    });
  });

  // ring follows the scroll
  ScrollTrigger.create({
    trigger: '.work', start: 'top top', end: 'bottom bottom',
    onUpdate: (s) => {
      ring?.setScroll(s.progress);
      $('#workBar').style.transform = `scaleX(${s.progress})`;
    },
  });

  // giant org names drift sideways
  $$('.chapter').forEach((ch) => {
    gsap.fromTo($('.ch-org-track', ch), { xPercent: 0 }, {
      xPercent: -34, ease: 'none',
      scrollTrigger: { trigger: ch, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // pipeline lights up step by step
  const pipe = $('#archPipe .pipe');
  const steps = $$('.pipe-step', pipe);
  ScrollTrigger.create({
    trigger: '#arch', start: 'top 72%', end: 'bottom 62%', scrub: true,
    onUpdate: (s) => {
      pipe.style.setProperty('--p', s.progress.toFixed(3));
      steps.forEach((st, i) => st.classList.toggle('is-lit', s.progress >= i / (steps.length - 1) - 0.02));
    },
  });

  // numbers slide sideways while pinned
  const track = $('#numbersTrack');
  gsap.to(track, {
    x: () => -(track.scrollWidth - window.innerWidth + parseFloat(getComputedStyle(track).paddingLeft)),
    ease: 'none',
    scrollTrigger: { trigger: '.numbers', start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true },
  });

  // headline masks
  $$('.section-title, .caps-title span, .contact-title span, .ch-role').forEach((el) => {
    const inner = document.createElement('span');
    inner.className = 'mask-inner';
    inner.innerHTML = el.innerHTML;
    el.innerHTML = '';
    el.append(inner);
    el.classList.add('mask');
    gsap.from(inner, {
      yPercent: 105, duration: reduced ? 0.01 : 1.2, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });
  $$('.functions li, .beyond-list li').forEach((el, i) => {
    gsap.from(el, {
      autoAlpha: 0, y: 30, duration: 1, ease: 'expo.out', delay: (i % 3) * 0.08,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  });
}

/* ----------------------------------------------------------------- ring */

function setActive(i) {
  const p = PROJECTS[i];
  $('#ringIndex').textContent = String(i + 1).padStart(2, '0');
  const box = $('.work-active');
  box.style.setProperty('--accent', ACCENTS[p.tone]);
  const parts = [$('#waOrg'), $('#waTitle'), $('#waValue'), $('#waLabel')];
  gsap.killTweensOf(parts);
  $('#waOrg').textContent = p.org;
  $('#waTitle').textContent = p.title;
  $('#waValue').textContent = p.metric.v;
  $('#waLabel').textContent = p.metric.l;
  if (!reduced) gsap.fromTo(parts, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
}

function ndc(x, y) {
  return { x: (x / window.innerWidth) * 2 - 1, y: -(y / window.innerHeight) * 2 + 1 };
}

function bindRing() {
  const stage = $('#workStage');
  stage.tabIndex = 0;
  stage.setAttribute('aria-label', 'Project ring. Use the left and right arrow keys to turn it and Enter to open the front project.');
  $('#waOpen').addEventListener('click', () => openProject(ring ? ring.active : 0));

  stage.addEventListener('keydown', (e) => {
    if (!ring || state.open) return;
    if (e.key === 'ArrowRight') { ring.rotateTo((ring.active + 1) % N); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { ring.rotateTo((ring.active - 1 + N) % N); e.preventDefault(); }
    if (e.key === 'Enter' && e.target === stage) openProject(ring.active);
  });

  if (!ring) return;
  let down = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a') || state.open) return;
    down = { x: e.clientX, last: e.clientX, moved: false };
    ring.dragStart();
    stage.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', (e) => {
    if (down) {
      const dx = e.clientX - down.last;
      down.last = e.clientX;
      if (Math.abs(e.clientX - down.x) > 6) down.moved = true;
      ring.dragMove(dx);
      return;
    }
    if (state.open || state.listOpen) { ring.hovered = -1; cursor.setMode(''); return; }
    const overStage = e.target.closest && e.target.closest('#workStage') && !e.target.closest('button, a');
    const i = overStage ? ring.hit(ndc(e.clientX, e.clientY)) : -1;
    ring.hovered = i;
    cursor.setMode(i >= 0 ? 'open' : overStage && ring.vis > 0.6 ? 'drag' : '', i >= 0 ? 'Open' : 'Drag');
  });
  const up = (e) => {
    if (!down) return;
    ring.dragEnd();
    stage.classList.remove('is-dragging');
    if (!down.moved && e.type === 'pointerup') {
      const i = ring.hit(ndc(e.clientX, e.clientY));
      if (i >= 0) openProject(i);
    }
    down = null;
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/* --------------------------------------------------------------- detail */

const detail = $('#detail');

function fitTitle() {
  const el = $('#dTitle');
  if (detail.hidden) return;
  el.style.fontSize = '';
  let size = parseFloat(getComputedStyle(el).fontSize);
  let guard = 0;
  while (el.scrollWidth > el.clientWidth + 1 && size > 26 && guard++ < 60) {
    size -= 2;
    el.style.fontSize = `${size}px`;
  }
}

function fillDetail(i) {
  const p = PROJECTS[i];
  detail.style.setProperty('--accent', ACCENTS[p.tone]);
  $('#dOrg').textContent = p.org;
  $('#dYear').textContent = p.year;
  $('#dKicker').textContent = p.kicker;
  $('#dTitle').textContent = p.title;
  fitTitle();
  $('#dSummary').textContent = p.summary;
  $('#dStats').innerHTML = p.stats.map((s) => `<div><dt>${s.l}</dt><dd>${s.v}</dd></div>`).join('');
  $('#dPoints').innerHTML = p.points.map((t) => `<li>${t}</li>`).join('');
  $('#dStack').innerHTML = p.stack.map((t) => `<li>${t}</li>`).join('');
  $('#dNote').textContent = p.note || '';
  const pw = $('#dPipeWrap');
  pw.hidden = !p.pipeline;
  $('#dPipe').innerHTML = p.pipeline ? pipelineHTML() : '';
  if (p.pipeline) $$('#dPipe .pipe-step').forEach((s) => s.classList.add('is-lit'));
  $('#dPipe .pipe')?.style.setProperty('--p', '1');
  const vis = $('#dVisual');
  vis.innerHTML = '';
  if (!engine) vis.append(cloneCanvas(canvases[i]));
  $('#dPrev').textContent = `Previous: ${PROJECTS[(i - 1 + N) % N].title}`;
  $('#dNext').textContent = `Next: ${PROJECTS[(i + 1) % N].title}`;
}

async function openProject(i) {
  if (state.busy || state.open) return;
  state.busy = true;
  state.opener = document.activeElement;
  lenis.stop();
  html.classList.add('is-locked');
  fillDetail(i);
  detail.hidden = false;
  detail.scrollTop = 0;
  fitTitle();
  const items = $$('[data-d]', detail);
  gsap.set(items, { autoAlpha: 0, y: 40 });
  gsap.set('#dClose', { autoAlpha: 0 });
  gsap.to('main, .nav', { autoAlpha: 0, duration: reduced ? 0.01 : 0.6, ease: 'power2.out' });
  cursor.setMode('');

  if (engine && ring) {
    detail.classList.remove('is-solid');
    ring.hovered = -1;
    if (Math.cos(ring.angleOf(i)) < 0.995) {
      ring.rotateTo(i);
      await waitFor(() => Math.cos(ring.angleOf(i)) > 0.996, 1400);
    }
    const flight = engine.openFocus(i, () => $('#dVisual').getBoundingClientRect(), reduced);
    gsap.to(items, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.06, ease: 'expo.out', delay: reduced ? 0 : 0.6 });
    gsap.to('#dClose', { autoAlpha: 1, duration: 0.5, delay: reduced ? 0 : 0.7 });
    await flight;
  } else {
    detail.classList.add('is-solid');
    gsap.fromTo(detail, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 });
    gsap.to(items, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.05, ease: 'expo.out', delay: 0.15 });
    gsap.to('#dClose', { autoAlpha: 1, duration: 0.4 });
  }
  state.open = true;
  state.current = i;
  state.busy = false;
  $('#dClose').focus({ preventScroll: true });
}

async function closeProject() {
  if (!state.open || state.busy) return;
  state.busy = true;
  const items = $$('[data-d]', detail);
  gsap.to([...items, $('#dClose')], { autoAlpha: 0, y: -14, duration: 0.4, stagger: 0.015, ease: 'power2.in' });
  if (engine && ring) {
    await engine.closeFocus(state.current, reduced);
  } else {
    await gsap.to(detail, { autoAlpha: 0, duration: 0.35, delay: 0.2 });
  }
  gsap.to('main, .nav', { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
  detail.hidden = true;
  gsap.set(detail, { clearProps: 'opacity,visibility' });
  html.classList.remove('is-locked');
  lenis.start();
  state.open = false;
  state.busy = false;
  state.opener?.focus?.({ preventScroll: true });
}

async function stepProject(dir) {
  if (!state.open || state.busy) return;
  state.busy = true;
  const next = (state.current + dir + N) % N;
  const items = $$('[data-d]', detail);
  await gsap.to(items, { autoAlpha: 0, y: -18, duration: 0.32, stagger: 0.015, ease: 'power2.in' });
  fillDetail(next);
  detail.scrollTo({ top: 0 });
  if (engine && ring) {
    engine.swapFocus(next);
    ring.rotateTo(next);
  }
  gsap.fromTo(items, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out' });
  state.current = next;
  state.busy = false;
}

function bindDetail() {
  $('#dClose').addEventListener('click', closeProject);
  $('#dPrev').addEventListener('click', () => stepProject(-1));
  $('#dNext').addEventListener('click', () => stepProject(1));
}

/* ----------------------------------------------------------------- list */

function buildList() {
  const rows = $('#plRows');
  rows.innerHTML = PROJECTS.map(
    (p, i) => `<li><button class="pl-row" type="button" data-i="${i}" style="--accent:${ACCENTS[p.tone]}">
      <span class="pl-t">${p.title}</span>
      <span class="pl-o">${p.org}</span>
      <span class="pl-m"><strong>${p.metric.v}</strong> ${p.metric.l}</span>
    </button></li>`,
  ).join('');
  const peek = $('#plPeek');
  const pc = document.createElement('canvas');
  pc.width = CARD_W / 2;
  pc.height = CARD_H / 2;
  peek.append(pc);
  const pctx = pc.getContext('2d');
  let shown = -1;
  const pos = { x: 0, y: 0 };
  const qx = gsap.quickTo(peek, 'x', { duration: 0.5, ease: 'power3' });
  const qy = gsap.quickTo(peek, 'y', { duration: 0.5, ease: 'power3' });
  rows.addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY;
    qx(pos.x + 24); qy(pos.y - pc.height / 2);
    const b = e.target.closest('.pl-row');
    const i = b ? +b.dataset.i : -1;
    if (i !== shown) {
      shown = i;
      if (i >= 0) {
        pctx.drawImage(canvases[i], 0, 0, pc.width, pc.height);
        gsap.to(peek, { autoAlpha: 1, scale: 1, duration: 0.35 });
      } else gsap.to(peek, { autoAlpha: 0, scale: 0.9, duration: 0.3 });
    }
  });
  rows.addEventListener('pointerleave', () => { shown = -1; gsap.to(peek, { autoAlpha: 0, scale: 0.9, duration: 0.3 }); });
  rows.addEventListener('click', async (e) => {
    const b = e.target.closest('.pl-row');
    if (!b) return;
    await closeList(true);
    openProject(+b.dataset.i);
  });
  $('#openList').addEventListener('click', openList);
  $('#plClose').addEventListener('click', () => closeList());
}

function openList() {
  if (state.listOpen || state.open) return;
  state.listOpen = true;
  state.opener = document.activeElement;
  const pl = $('#plist');
  pl.hidden = false;
  lenis.stop();
  html.classList.add('is-locked');
  gsap.fromTo(pl, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: reduced ? 0.01 : 0.9, ease: 'expo.inOut' });
  gsap.fromTo('.pl-row', { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.9, stagger: 0.035, ease: 'expo.out', delay: reduced ? 0 : 0.35 });
  $('#plClose').focus({ preventScroll: true });
}

async function closeList(keepLocked = false) {
  if (!state.listOpen) return;
  const pl = $('#plist');
  await gsap.to(pl, { clipPath: 'inset(0% 0% 100% 0%)', duration: reduced ? 0.01 : 0.75, ease: 'expo.inOut' });
  pl.hidden = true;
  state.listOpen = false;
  if (!keepLocked) {
    html.classList.remove('is-locked');
    lenis.start();
    state.opener?.focus?.({ preventScroll: true });
  }
}

/* --------------------------------------------------------------- misc */

function bindMisc() {
  $$('[data-scramble]').forEach((a) => a.addEventListener('pointerenter', () => scramble(a)));
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id === '#top' ? 0 : $(id);
      if (target === null) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: reduced ? 0 : 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    }),
  );
  $('#copyMail').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try {
      await navigator.clipboard.writeText(PROFILE.email);
      b.textContent = 'Copied to clipboard';
    } catch {
      b.textContent = 'Copy failed, use the link';
    }
    setTimeout(() => (b.textContent = 'Copy email'), 2200);
  });
  document.addEventListener('keydown', (e) => {
    if (state.open) {
      if (e.key === 'Escape') closeProject();
      if (e.key === 'ArrowRight') stepProject(1);
      if (e.key === 'ArrowLeft') stepProject(-1);
    } else if (state.listOpen && e.key === 'Escape') closeList();
  });
}

function flatFallback() {
  html.classList.add('no-gl');
  const fb = $('#workFallback');
  canvases.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fb-card';
    b.setAttribute('aria-label', `Open ${PROJECTS[i].title}`);
    b.append(cloneCanvas(c));
    b.addEventListener('click', () => openProject(i));
    fb.append(b);
  });
}

boot();
