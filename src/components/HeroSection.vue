<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

// 3 clips que se encadenan con crossfade + zoom al terminar cada uno.
const clips = ['/videos/1.mp4', '/videos/5.mp4', '/videos/7.mp4']
const videoEls = ref([])
const active = ref(0)

function onEnded() {
  next()
}
function next() {
  const nextIdx = (active.value + 1) % clips.length
  const el = videoEls.value[nextIdx]
  if (el) {
    el.currentTime = 0
    el.play().catch(() => {})
  }
  active.value = nextIdx
  // prefetch del clip que sigue para que el crossfade no espere descarga
  const after = videoEls.value[(nextIdx + 1) % clips.length]
  if (after && after.preload === 'none') {
    after.preload = 'auto'
    after.load()
  }
}

const titleWrap = ref(null)
const bgLayer = ref(null)
let raf = null
let targetY = 0

function onScroll() {
  targetY = window.scrollY
  if (!raf) raf = requestAnimationFrame(apply)
}
function apply() {
  const y = targetY
  if (titleWrap.value) {
    titleWrap.value.style.transform = `translateY(${y * 0.25}px)`
    titleWrap.value.style.opacity = `${Math.max(0, 1 - y / 600)}`
  }
  if (bgLayer.value) {
    bgLayer.value.style.transform = `translateY(${y * 0.12}px)`
  }
  raf = null
}

// pointer-driven glow
const glow = ref({ x: 50, y: 40 })
function onMove(e) {
  glow.value = {
    x: (e.clientX / window.innerWidth) * 100,
    y: (e.clientY / window.innerHeight) * 100,
  }
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('mousemove', onMove)
  videoEls.value[0]?.play().catch(() => {})
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('mousemove', onMove)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <section
    class="hero"
    :style="{
      '--gx': glow.x + '%',
      '--gy': glow.y + '%',
    }"
  >
    <div ref="bgLayer" class="hero-bg">
      <video
        v-for="(clip, i) in clips"
        :key="clip"
        :ref="(el) => (videoEls[i] = el)"
        :src="clip"
        class="hero-clip"
        :class="{ active: active === i }"
        muted
        playsinline
        :preload="i === 0 ? 'auto' : 'none'"
        :autoplay="i === 0"
        @ended="onEnded"
        @canplay="active === i && $event.target.play().catch(() => {})"
      ></video>
      <div class="hero-bg-tint"></div>
      <div class="hero-progress" aria-hidden="true">
        <span
          v-for="(clip, i) in clips"
          :key="'p' + i"
          class="bar"
          :class="{ on: active === i }"
        ></span>
      </div>
    </div>

    <div class="hero-glow"></div>

    <div ref="titleWrap" class="hero-inner container">
      <p class="hero-kicker">
        <span class="dot"></span> Estudio creativo
      </p>

      <h1 class="hero-title">
        <span class="line"><span class="line-inner"><em>Creamos</em> cosas</span></span>
        <span class="line"><span class="line-inner">que se <mark>sienten</mark></span></span>
        <span class="line"><span class="line-inner">y funcionan.</span></span>
      </h1>

      <div class="hero-foot">
        <a href="#work" class="cta" data-cursor="hover">
          Ver el trabajo
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <p class="hero-note">
          Video, imagen y marca. Nos mueve el resultado final.<br />
          Rápidos, curiosos y potenciados con IA.
        </p>
      </div>
    </div>

    <div class="scroll-cue" aria-hidden="true">
      <span>Scroll</span>
      <div class="scroll-line"></div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: flex-end;
  padding-bottom: clamp(3rem, 8vh, 7rem);
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  will-change: transform;
}
.hero-clip {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.18);
  filter: grayscale(0.6) brightness(0.32) contrast(1.05) blur(6px);
  transition: opacity 1.4s var(--ease), transform 6s linear, filter 1.4s var(--ease);
  pointer-events: none;
}
.hero-clip.active {
  opacity: 1;
  transform: scale(1.06);
  filter: grayscale(0.5) brightness(0.42) contrast(1.05) blur(0);
}

.hero-progress {
  position: absolute;
  left: 5vw;
  top: clamp(6rem, 14vh, 9rem);
  z-index: 2;
  display: flex;
  gap: 8px;
}
.hero-progress .bar {
  width: 34px;
  height: 3px;
  border-radius: 2px;
  background: rgba(242, 240, 235, 0.22);
  transition: background 0.5s var(--ease), width 0.5s var(--ease);
}
.hero-progress .bar.on {
  width: 54px;
  background: var(--accent);
}
.hero-bg-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(
      180deg,
      rgba(10, 10, 12, 0.55) 0%,
      rgba(10, 10, 12, 0.35) 40%,
      rgba(10, 10, 12, 0.95) 100%
    );
}

.hero-glow {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: radial-gradient(
    420px circle at var(--gx) var(--gy),
    rgba(214, 255, 63, 0.14),
    transparent 60%
  );
  transition: background 0.2s linear;
}

.hero-inner {
  position: relative;
  z-index: 2;
  width: min(1320px, 90vw);
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-dim);
  margin-bottom: 1.8rem;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 0 rgba(214, 255, 63, 0.6);
  animation: pulse 2.2s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(214, 255, 63, 0.5); }
  70% { box-shadow: 0 0 0 12px rgba(214, 255, 63, 0); }
  100% { box-shadow: 0 0 0 0 rgba(214, 255, 63, 0); }
}

.hero-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2.2rem, 6.5vw, 5.4rem);
  line-height: 1;
  letter-spacing: -0.015em;
  word-spacing: 0.12em;
  max-width: 15ch;
}
.hero-title .line {
  display: block;
  overflow: hidden;
}
.hero-title .line-inner {
  display: inline-block;
  animation: rise 1s var(--ease) both;
}
.hero-title .line:nth-child(1) .line-inner { animation-delay: 0.1s; }
.hero-title .line:nth-child(2) .line-inner { animation-delay: 0.24s; }
.hero-title .line:nth-child(3) .line-inner { animation-delay: 0.38s; }
.hero-title em {
  font-style: italic;
  color: var(--fg-dim);
}
.hero-title mark {
  background: none;
  color: var(--accent);
}
@keyframes rise {
  from { transform: translateY(110%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.hero-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  margin-top: clamp(2rem, 5vw, 3.5rem);
}
.cta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 1rem 1.6rem;
  border: 1px solid var(--accent);
  border-radius: 100px;
  color: var(--accent);
  font-weight: 500;
  font-size: 1rem;
  transition: background 0.3s var(--ease), color 0.3s var(--ease), gap 0.3s var(--ease);
}
.cta:hover {
  background: var(--accent);
  color: #000;
  gap: 18px;
}
.hero-note {
  max-width: 320px;
  color: var(--fg-dim);
  font-size: 0.9rem;
  text-align: right;
  margin-left: auto;
}

.scroll-cue {
  position: absolute;
  right: 5vw;
  top: 50%;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--fg-dim);
  writing-mode: vertical-rl;
}
.scroll-line {
  width: 1px;
  height: 60px;
  background: linear-gradient(var(--accent), transparent);
  animation: drop 1.8s var(--ease) infinite;
}
@keyframes drop {
  0% { transform: scaleY(0); transform-origin: top; }
  50% { transform: scaleY(1); transform-origin: top; }
  50.1% { transform-origin: bottom; }
  100% { transform: scaleY(0); transform-origin: bottom; }
}

@media (max-width: 720px) {
  .hero-note { text-align: left; margin-left: 0; }
  .scroll-cue { display: none; }
}
</style>
