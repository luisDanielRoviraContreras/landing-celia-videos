<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

// Port a Vue de "Hyper Scroll" (aleksa-rakocevic / CodePen).
// Túnel 3D: cards, textos y estrellas a distintas profundidades Z.
// El scroll de la sección vuela la cámara. Overlays CRT (scanlines/noise/vignette).
// Adaptado a nuestros colores y a scroll vertical de la página (no Lenis propio).

const TEXTS = ['CREAR', 'RÁPIDO', 'IDEAS']
const CARD_WORDS = ['IDEA', 'VIDEO', 'IMAGEN', 'MOTION', 'MARCA', 'RITMO', 'COLOR', 'CORTE', 'LUZ']

const Z_GAP = 850
// colores de marca (sin rojo/cyan)
const CARD_COLORS = ['#d6ff3f', '#7b5cff', '#ff5c38', '#f2f0eb']

// construir la lista de items (determinista-ish)
function rand(seed) {
  // pseudo-random estable por índice (evita Math.random en setup)
  const x = Math.sin(seed * 99.13) * 43758.5453
  return x - Math.floor(x)
}

const N = 12 // 3 textos (i%4==0 -> 0,4,8) + 9 cards
const items = []
let headingIdx = 0
let cardIdx = 0
for (let i = 0; i < N; i++) {
  const isHeading = i % 4 === 0
  if (isHeading) {
    items.push({
      type: 'text',
      text: TEXTS[headingIdx % TEXTS.length],
      x: 0,
      y: 0,
      rot: (rand(i) - 0.5) * 16,
      baseZ: -i * Z_GAP,
    })
    headingIdx++
  } else {
    const angle = (i / N) * Math.PI * 6
    items.push({
      type: 'card',
      word: CARD_WORDS[cardIdx % CARD_WORDS.length],
      id: Math.floor(rand(i * 7) * 9999),
      grid: `${Math.floor(rand(i) * 10)}x${Math.floor(rand(i * 3) * 10)}`,
      data: (rand(i * 5) * 100).toFixed(1),
      num: i,
      x: Math.cos(angle) * 420 * (rand(i * 2) > 0.5 ? 1 : -1),
      y: Math.sin(angle) * 300,
      rot: (rand(i * 4) - 0.5) * 26,
      accent: CARD_COLORS[cardIdx % CARD_COLORS.length],
      baseZ: -i * Z_GAP,
    })
    cardIdx++
  }
}
// estrellas
const STAR_COUNT = 120
const TOTAL_DEPTH = N * Z_GAP
for (let i = 0; i < STAR_COUNT; i++) {
  items.push({
    type: 'star',
    x: (rand(i * 11) - 0.5) * 3000,
    y: (rand(i * 13) - 0.5) * 3000,
    baseZ: -rand(i * 17) * TOTAL_DEPTH,
  })
}

const sectionEl = ref(null)
const viewportEl = ref(null)
const worldEl = ref(null)
const itemEls = ref([])

let raf = null
let inView = false
let lastScroll = 0
let velocity = 0
let cameraZ = 0
const mouse = { x: 0, y: 0 }

function onMouseMove(e) {
  mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
  mouse.y = (e.clientY / window.innerHeight - 0.5) * 2
}

function frame(time) {
  raf = requestAnimationFrame(frame)
  const el = sectionEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const total = r.height - window.innerHeight
  const passed = Math.min(Math.max(-r.top, 0), total)
  const progress = total > 0 ? passed / total : 0
  inView = r.bottom > 0 && r.top < window.innerHeight
  if (!inView) return

  // velocidad suavizada desde el scroll
  const v = window.scrollY - lastScroll
  lastScroll = window.scrollY
  velocity += (v - velocity) * 0.1

  // cámara avanza por el túnel según el progreso.
  // tope < TOTAL_DEPTH => la última card sigue visible al final (sin cola negra)
  cameraZ = progress * (TOTAL_DEPTH - 700)

  // tilt de cámara + warp de perspectiva por velocidad
  const tiltX = mouse.y * 5 - velocity * 0.2
  const tiltY = mouse.x * 5
  worldEl.value.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
  const fov = 1000 - Math.min(Math.abs(velocity) * 8, 550)
  viewportEl.value.style.perspective = `${fov}px`

  const t = time * 0.001
  for (let k = 0; k < items.length; k++) {
    const item = items[k]
    const dom = itemEls.value[k]
    if (!dom) continue
    const vizZ = item.baseZ + cameraZ

    // opacidad: aparece lejos, desaparece al pasar la cámara
    let alpha = 1
    if (vizZ < -3200) alpha = 0
    else if (vizZ < -2200) alpha = (vizZ + 3200) / 1000
    if (vizZ > 120 && item.type !== 'star') alpha = 1 - (vizZ - 120) / 400
    if (alpha < 0) alpha = 0
    dom.style.opacity = alpha
    if (alpha <= 0) continue

    let trans = `translate3d(${item.x}px, ${item.y}px, ${vizZ}px)`
    if (item.type === 'star') {
      const stretch = Math.max(1, Math.min(1 + Math.abs(velocity) * 0.08, 9))
      trans += ` scale3d(1,1,${stretch})`
    } else if (item.type === 'text') {
      trans += ` rotateZ(${item.rot}deg)`
      if (Math.abs(velocity) > 1) {
        const off = velocity * 1.6
        dom.style.textShadow = `${off}px 0 #d6ff3f, ${-off}px 0 #7b5cff`
      } else {
        dom.style.textShadow = 'none'
      }
    } else {
      const float = Math.sin(t + item.x) * 8
      trans += ` rotateZ(${item.rot}deg) rotateY(${float}deg)`
    }
    dom.style.transform = trans
  }
}

onMounted(() => {
  lastScroll = window.scrollY
  window.addEventListener('mousemove', onMouseMove)
  raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<template>
  <section ref="sectionEl" class="hyper">
    <div class="pin">
      <div ref="viewportEl" class="viewport">
        <div ref="worldEl" class="world">
          <div
            v-for="(item, i) in items"
            :key="i"
            class="item"
            :ref="(el) => (itemEls[i] = el)"
          >
            <div v-if="item.type === 'text'" class="big-text">{{ item.text }}</div>

            <div v-else-if="item.type === 'card'" class="card" data-cursor="hover">
              <div class="card-header">
                <span class="card-id" :style="{ color: item.accent }">ID-{{ item.id }}</span>
                <span class="card-dot" :style="{ background: item.accent }"></span>
              </div>
              <h2>{{ item.word }}</h2>
              <div class="card-footer">
                <span>GRID: {{ item.grid }}</span>
                <span>DATA: {{ item.data }}MB</span>
              </div>
              <span class="card-num">0{{ item.num }}</span>
            </div>

            <div v-else class="star"></div>
          </div>
        </div>
      </div>

      <!-- overlays CRT (sin noise: usa el grano global de la web) -->
      <div class="scanlines"></div>
      <div class="vignette"></div>

      <!-- HUD -->
      <div class="hud">
        <div class="hud-top">
          <span>// HYPER_SCROLL</span>
          <span class="hud-line"></span>
          <span><strong>LR</strong> · MOTION</span>
        </div>
        <div class="hud-bottom">
          <span>SYS · OK</span>
          <span class="hud-line"></span>
          <span>SCROLL ▼</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hyper {
  position: relative;
  height: 600vh;
  border-top: 1px solid var(--line);
  background: var(--bg);
}
.pin {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: hidden;
  cursor: crosshair;
}

.viewport {
  position: absolute;
  inset: 0;
  perspective: 1000px;
  overflow: hidden;
  z-index: 1;
}
.world {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-style: preserve-3d;
  will-change: transform;
}
.item {
  position: absolute;
  left: 0;
  top: 0;
  backface-visibility: hidden;
  transform-origin: center center;
  display: flex;
  align-items: center;
  justify-content: center;
  will-change: transform, opacity;
}

/* cards */
.card {
  width: 320px;
  height: 460px;
  background: rgba(10, 10, 10, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  backdrop-filter: blur(8px);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5), 0 20px 50px rgba(0, 0, 0, 0.5);
  transition: border-color 0.3s, box-shadow 0.3s, background 0.3s;
  transform: translate(-50%, -50%);
}
.card::before,
.card::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border: 1px solid transparent;
  transition: 0.3s;
}
.card::before {
  top: -1px;
  left: -1px;
  border-top-color: var(--fg);
  border-left-color: var(--fg);
}
.card::after {
  bottom: -1px;
  right: -1px;
  border-bottom-color: var(--fg);
  border-right-color: var(--fg);
}
@media (hover: hover) {
  .card:hover {
    border-color: var(--accent);
    box-shadow: 0 0 30px rgba(214, 255, 63, 0.25);
    background: rgba(20, 20, 20, 0.85);
  }
  .card:hover::before,
  .card:hover::after {
    width: calc(100% + 2px);
    height: calc(100% + 2px);
    border-color: var(--accent);
  }
}
.card-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.card-id {
  font-family: var(--font-body);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}
.card-dot {
  width: 10px;
  height: 10px;
}
.card h2 {
  font-family: var(--font-display);
  font-size: 2.6rem;
  line-height: 0.9;
  margin: 0;
  text-transform: uppercase;
  font-weight: 700;
  color: #fff;
}
.card-footer {
  margin-top: auto;
  font-family: var(--font-body);
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  justify-content: space-between;
}
.card-num {
  position: absolute;
  bottom: 1.5rem;
  right: 1.5rem;
  font-size: 4rem;
  opacity: 0.1;
  font-weight: 900;
  font-family: var(--font-display);
}

/* big text */
.big-text {
  font-family: var(--font-display);
  font-size: 15vw;
  font-weight: 800;
  color: transparent;
  -webkit-text-stroke: 2px rgba(255, 255, 255, 0.16);
  text-transform: uppercase;
  white-space: nowrap;
  transform: translate(-50%, -50%);
  pointer-events: none;
  letter-spacing: -0.4rem;
}

.star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #fff;
  transform: translate(-50%, -50%);
}

/* overlays */
.scanlines {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0),
    rgba(255, 255, 255, 0) 50%,
    rgba(0, 0, 0, 0.2) 50%,
    rgba(0, 0, 0, 0.2)
  );
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 10;
}
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, transparent 40%, #000 120%);
  z-index: 11;
  pointer-events: none;
}
/* HUD */
.hud {
  position: absolute;
  inset: 2rem;
  z-index: 20;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-family: var(--font-body);
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}
.hud-top,
.hud-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.hud strong {
  color: var(--accent);
}
.hud-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 1rem;
}
</style>
