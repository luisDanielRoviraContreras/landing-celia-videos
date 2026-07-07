<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

// Port a Vue de davidfaure/horizontal-parallax-gallery-codrops (versión DOM).
// El scroll VERTICAL de la sección mueve la galería en horizontal, con
// parallax counter-motion en cada video (video al 125% de ancho).
const videos = Array.from({ length: 13 }, (_, i) => `/chicas/${i + 1}.mp4`)

const sectionEl = ref(null)
const pinEl = ref(null)
const trackEl = ref(null)
const barEl = ref(null)
const mediaEls = ref([])
const videoEls = ref([])
const loaded = ref(videos.map(() => false))

let raf = null
let currentX = 0
let inView = false
let io = null
let loadIO = null

function lerp(a, b, t) {
  return a + (b - a) * t
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function progress() {
  const el = sectionEl.value
  if (!el) return 0
  const r = el.getBoundingClientRect()
  const total = r.height - window.innerHeight
  const passed = clamp(-r.top, 0, total)
  inView = r.bottom > 0 && r.top < window.innerHeight
  return total > 0 ? passed / total : 0
}

function applyParallax() {
  const vw = window.innerWidth
  const center = vw * 0.5
  for (const v of videoEls.value) {
    if (!v) continue
    const parent = v.parentElement
    if (!parent) continue
    const rect = parent.getBoundingClientRect()
    const elCenter = rect.left + rect.width * 0.5
    const t = clamp((elCenter - center) / center, -1, 1)
    // parallax por SCALE (>=1) => el video siempre cubre al 100%, sin huecos.
    // más grande en el centro, se relaja hacia los lados.
    const scale = 1.12 - Math.abs(t) * 0.12
    v.style.transform = `scale(${scale})`
  }
}

function frame() {
  raf = requestAnimationFrame(frame)
  if (!inView && currentX === 0) {
    progress() // sigue midiendo para detectar entrada
    return
  }
  const p = progress()
  const track = trackEl.value
  const pin = pinEl.value
  if (!track || !pin) return

  const limit = Math.max(track.scrollWidth - pin.clientWidth, 0)
  const targetX = p * limit
  currentX = lerp(currentX, targetX, 0.09)
  track.style.transform = `translate3d(${-currentX}px, 0, 0)`
  applyParallax()
  if (barEl.value) barEl.value.style.width = `${p * 100}%`
}

onMounted(() => {
  // reproduce solo en viewport
  io = new IntersectionObserver(
    (entries) => {
      inView = entries[0].isIntersecting
      videoEls.value.forEach((v) => {
        if (!v) return
        if (inView) v.play?.().catch(() => {})
        else v.pause?.()
      })
    },
    { threshold: 0.05 }
  )
  if (sectionEl.value) io.observe(sectionEl.value)

  // lazy-load de los videos al acercarse
  loadIO = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        loaded.value = videos.map(() => true)
        loadIO.disconnect()
      }
    },
    { rootMargin: '900px 0px' }
  )
  if (sectionEl.value) loadIO.observe(sectionEl.value)

  frame()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  io?.disconnect()
  loadIO?.disconnect()
})
</script>

<template>
  <section ref="sectionEl" class="pgallery">
    <div ref="pinEl" class="pin">
      <header class="pg-head container">
        <p class="eyebrow">// Galería</p>
        <h2 class="pg-title">Lo que creamos.</h2>
      </header>

      <div class="gallery__wrapper">
        <div ref="trackEl" class="gallery__image__container">
          <div
            v-for="(src, i) in videos"
            :key="i"
            class="gallery__media"
            :ref="(el) => (mediaEls[i] = el)"
            :data-i="i"
          >
            <video
              class="gallery__media__video"
              :ref="(el) => (videoEls[i] = el)"
              :src="loaded[i] ? src : undefined"
              muted
              loop
              playsinline
              preload="metadata"
            ></video>
            <span class="pg-index">{{ String(i + 1).padStart(2, '0') }}</span>
          </div>
        </div>
      </div>

      <div class="pg-progress" aria-hidden="true"><span ref="barEl"></span></div>
    </div>
  </section>
</template>

<style scoped>
@media (max-width: 640px) { .pgallery { height: 300vh !important; } }
.pgallery {
  position: relative;
  height: 420vh;
  border-top: 1px solid var(--line);
  background: var(--bg);
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

.pg-head {
  position: absolute;
  top: clamp(4rem, 10vh, 7rem);
  left: 50%;
  transform: translateX(-50%);
  width: min(1320px, 90vw);
  display: flex;
  align-items: baseline;
  gap: 1.4rem;
  z-index: 3;
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}
.pg-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.8rem, 4.4vw, 3.4rem);
  line-height: 1;
  letter-spacing: -0.02em;
}

/* --- galería (adaptado del original) --- */
.gallery__wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  user-select: none;
}
.gallery__image__container {
  display: flex;
  gap: 2rem;
  padding-inline: 5vw;
  will-change: transform;
  width: max-content;
}
.gallery__media {
  flex-shrink: 0;
  aspect-ratio: 9 / 16; /* portrait: se ve todo el video vertical */
  height: 56vh;
  overflow: hidden;
  position: relative;
  display: block;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
}
.gallery__media__video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  will-change: transform;
}
.pg-index {
  position: absolute;
  left: 14px;
  bottom: 12px;
  z-index: 2;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--fg);
  mix-blend-mode: difference;
}

.pg-progress {
  position: absolute;
  left: 5vw;
  right: 5vw;
  bottom: 6vh;
  height: 2px;
  background: var(--line);
  z-index: 3;
}
.pg-progress span {
  display: block;
  height: 100%;
  width: 0;
  background: var(--accent);
}

@media (max-width: 720px) {
  .gallery__media {
    height: 62vh;
  }
}
</style>
