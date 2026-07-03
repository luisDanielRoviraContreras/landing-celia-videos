<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

// Scroll vertical -> desplazamiento horizontal (pinned).
const sectionEl = ref(null)
const trackEl = ref(null)
const barEl = ref(null)
let raf = null

const panels = [
  { k: 'Reels', t: 'Contenido que retiene', d: 'Ganchos en 3 segundos, ritmo para redes.' },
  { k: 'Branding', t: 'Identidad con carácter', d: 'Marca y visuales que se sienten propios.' },
  { k: 'Film', t: 'Piezas con alma', d: 'Cortos y spots con mirada de autor.' },
  { k: 'Ads', t: 'Producción a escala', d: 'Decenas de variantes en horas, no semanas.' },
]

function onScroll() {
  if (!raf) raf = requestAnimationFrame(apply)
}
function apply() {
  const el = sectionEl.value
  const track = trackEl.value
  if (el && track) {
    const r = el.getBoundingClientRect()
    const total = r.height - window.innerHeight
    const p = Math.min(Math.max(-r.top, 0), total) / (total || 1)
    const maxX = track.scrollWidth - window.innerWidth
    track.style.transform = `translateX(${-p * maxX}px)`
    if (barEl.value) barEl.value.style.width = `${8 + p * 92}%`
  }
  raf = null
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  apply()
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <section ref="sectionEl" class="hreel">
    <div class="pin">
      <div class="hreel-head container">
        <p class="eyebrow">// Enfoque</p>
        <h2 class="hreel-title">Lo que hacemos mejor.</h2>
      </div>

      <div ref="trackEl" class="track">
        <article v-for="(p, i) in panels" :key="i" class="panel">
          <span class="panel-flood" aria-hidden="true"></span>
          <span class="panel-index">0{{ i + 1 }} / 04</span>
          <span class="panel-kicker">{{ p.k }}</span>
          <h3 class="panel-title" :data-text="p.t">{{ p.t }}</h3>
          <p class="panel-desc">{{ p.d }}</p>
        </article>
      </div>

      <div class="hreel-progress" aria-hidden="true"><span ref="barEl"></span></div>
    </div>
  </section>
</template>

<style scoped>
.hreel {
  position: relative;
  height: 360vh;
  border-top: 1px solid var(--line);
}
.pin {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* por encima del blur de página (z 190) para que la barra de progreso no se difumine */
  z-index: 200;
}
.hreel-head {
  position: absolute;
  top: clamp(4rem, 9vh, 6.5rem);
  left: 50%;
  transform: translateX(-50%);
  width: min(1320px, 90vw);
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.6rem 1.6rem;
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}
.hreel-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.9rem, 4.4vw, 3.6rem);
  line-height: 1;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.track {
  display: flex;
  gap: clamp(1.4rem, 3vw, 2.4rem);
  padding-inline: 5vw;
  will-change: transform;
}
.panel {
  position: relative;
  overflow: hidden;
  flex: 0 0 auto;
  width: min(46vw, 560px);
  height: 52vh;
  padding: clamp(1.8rem, 3vw, 2.8rem);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.8rem;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: linear-gradient(160deg, var(--bg-soft), #17171b);
  transition: border-color 0.4s var(--ease), transform 0.4s var(--ease),
    box-shadow 0.4s var(--ease);
}
.panel > * {
  position: relative;
  z-index: 2;
}
.panel:hover {
  border-color: var(--accent);
  transform: translateY(-10px) scale(1.015);
  box-shadow: 0 30px 80px -30px rgba(214, 255, 63, 0.35);
}

/* flood de acento que sube en diagonal al hover */
.panel-flood {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(
      120% 90% at 20% 120%,
      rgba(214, 255, 63, 0.22),
      transparent 55%
    ),
    linear-gradient(160deg, rgba(123, 92, 255, 0.14), transparent 60%);
  opacity: 0;
  transform: translateY(30%) scale(1.1);
  transition: opacity 0.5s var(--ease), transform 0.6s var(--ease);
}
.panel:hover .panel-flood {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* glitch RGB en el título al hover */
.panel-title {
  position: relative;
}
.panel-title::before,
.panel-title::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  clip-path: inset(0);
}
.panel:hover .panel-title::before {
  opacity: 0.9;
  color: #ff2e63;
  animation: glitchA 0.5s steps(2, end) infinite;
}
.panel:hover .panel-title::after {
  opacity: 0.9;
  color: var(--accent);
  animation: glitchB 0.5s steps(2, end) infinite;
}
.panel:hover .panel-title {
  animation: jitter 0.28s steps(2, end) infinite;
}
@keyframes glitchA {
  0% { transform: translate(0, 0); clip-path: inset(0 0 62% 0); }
  25% { transform: translate(-3px, 1px); clip-path: inset(38% 0 18% 0); }
  50% { transform: translate(2px, -1px); clip-path: inset(72% 0 8% 0); }
  75% { transform: translate(-2px, 1px); clip-path: inset(20% 0 55% 0); }
  100% { transform: translate(0, 0); clip-path: inset(0 0 62% 0); }
}
@keyframes glitchB {
  0% { transform: translate(0, 0); clip-path: inset(60% 0 12% 0); }
  25% { transform: translate(3px, -1px); clip-path: inset(12% 0 60% 0); }
  50% { transform: translate(-2px, 1px); clip-path: inset(48% 0 30% 0); }
  75% { transform: translate(2px, -1px); clip-path: inset(78% 0 4% 0); }
  100% { transform: translate(0, 0); clip-path: inset(60% 0 12% 0); }
}
@keyframes jitter {
  0%, 100% { transform: translate(0, 0); }
  33% { transform: translate(-1px, 1px); }
  66% { transform: translate(1px, -1px); }
}
.panel-index {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--fg-dim);
}
.panel-kicker {
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}
.panel-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.6rem, 3.5vw, 2.8rem);
  line-height: 1.02;
  letter-spacing: -0.01em;
}
.panel-desc {
  color: var(--fg-dim);
  font-size: 1rem;
  max-width: 34ch;
}

.hreel-progress {
  position: absolute;
  left: 5vw;
  right: 5vw;
  bottom: 8vh;
  height: 2px;
  background: var(--line);
}
.hreel-progress span {
  display: block;
  height: 100%;
  width: 25%;
  background: var(--accent);
  animation: none;
}

@media (max-width: 720px) {
  .panel {
    width: 78vw;
    height: 46vh;
  }
}
</style>
