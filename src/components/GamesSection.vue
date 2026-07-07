<script setup>
import { ref, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'

// juego cargado bajo demanda (three.js) para no pesar el bundle inicial
const RunnerGame = defineAsyncComponent(() => import('./RunnerGame.vue'))
const playing = ref(false)

// slot de imagen: personajes cyberpunk. Fondo negro sólido -> se funde con la
// sección vía máscara de bordes (.stage-chars mask-image).
const CHARS_SRC = '/game.png'
const hasImg = ref(true)

const tags = ['Diseño de personajes', 'Mundos & niveles', 'Prototipos jugables', 'Arte & dirección']

// parallax por puntero: mueve personajes y glow.
const stage = ref(null)
const px = ref(50) // %
const py = ref(50)
const tiltX = ref(0)
const tiltY = ref(0)
let raf = null
let pending = null

function onMove(e) {
  const el = stage.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  pending = { x, y }
  if (!raf) raf = requestAnimationFrame(apply)
}
function apply() {
  raf = null
  if (!pending) return
  const { x, y } = pending
  px.value = x * 100
  py.value = y * 100
  // desplazamiento sutil de los personajes en sentido contrario al puntero
  tiltX.value = (0.5 - x) * 26
  tiltY.value = (0.5 - y) * 14
}
function onLeave() {
  pending = { x: 0.5, y: 0.5 }
  if (!raf) raf = requestAnimationFrame(apply)
}

onMounted(() => {
  const el = stage.value
  if (el) {
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
  }
})
onBeforeUnmount(() => {
  const el = stage.value
  if (el) {
    el.removeEventListener('mousemove', onMove)
    el.removeEventListener('mouseleave', onLeave)
  }
  cancelAnimationFrame(raf)
})
</script>

<template>
  <section
    class="games"
    id="games"
    :style="{ '--gx': px + '%', '--gy': py + '%' }"
  >
    <div class="games-grid" aria-hidden="true"></div>
    <div class="games-glow" aria-hidden="true"></div>

    <div class="container games-inner">
      <header class="games-head">
        <p class="eyebrow reveal">// Videojuegos</p>
        <h2 class="games-title reveal" data-reveal-delay="80">
          También<br /><em>jugamos</em> a crear<br /><mark>videojuegos.</mark>
        </h2>
        <p class="games-lead reveal" data-reveal-delay="160">
          Personajes, mundos y mecánicas. Del concepto al prototipo jugable —
          con dirección de arte propia y potenciados con IA para iterar rápido
          sin perder el estilo.
        </p>
      </header>

      <div ref="stage" class="games-stage reveal" data-reveal-delay="120">
        <div class="stage-ring" aria-hidden="true"></div>
        <div class="stage-scan" aria-hidden="true"></div>

        <img
          v-if="hasImg"
          :src="CHARS_SRC"
          alt="Personajes originales para videojuegos"
          class="stage-chars"
          :style="{ transform: `translate3d(${tiltX}px, ${tiltY}px, 0)` }"
          @error="hasImg = false"
        />
        <div v-else class="stage-placeholder">
          <span class="ph-a"></span>
          <span class="ph-b"></span>
          <p class="ph-note">
            Coloca <code>public/videojuegos.png</code><br />
            (dos personajes de frente, fondo transparente)
          </p>
        </div>

        <div class="stage-floor" aria-hidden="true"></div>

        <span class="badge badge-tl">P1</span>
        <span class="badge badge-tr">P2</span>
        <span class="chip chip-1">64 FPS</span>
        <span class="chip chip-2">RPG · Action</span>

        <button class="play-btn" @click="playing = true" data-cursor="hover" aria-label="Jugar">
          <span class="play-ico">▶</span>
          <span class="play-txt">Jugar demo</span>
          <span class="play-pulse" aria-hidden="true"></span>
        </button>
      </div>

      <footer class="games-foot reveal" data-reveal-delay="200">
        <ul class="tags">
          <li v-for="t in tags" :key="t" data-cursor="hover">{{ t }}</li>
        </ul>
        <a href="#contact" class="cta" data-cursor="hover">
          Hablemos de tu juego
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </footer>
    </div>
  </section>

  <Teleport to="body">
    <RunnerGame v-if="playing" @close="playing = false" />
  </Teleport>
</template>

<style scoped>
.games {
  position: relative;
  padding: clamp(5rem, 12vw, 10rem) 0;
  border-top: 1px solid var(--line);
  overflow: hidden;
}

/* grid cyberpunk de fondo */
.games-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: radial-gradient(120% 90% at 50% 30%, #000 30%, transparent 78%);
  -webkit-mask-image: radial-gradient(120% 90% at 50% 30%, #000 30%, transparent 78%);
}

/* glow que sigue al puntero + tinte violeta/naranja de los personajes */
.games-glow {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
      520px circle at var(--gx) var(--gy),
      rgba(214, 255, 63, 0.12),
      transparent 60%
    ),
    radial-gradient(60% 55% at 22% 78%, rgba(123, 92, 255, 0.16), transparent 70%),
    radial-gradient(55% 50% at 82% 26%, rgba(255, 92, 56, 0.12), transparent 72%);
  transition: background 0.2s linear;
}

.games-inner {
  position: relative;
  z-index: 2;
}

.games-head {
  max-width: 60ch;
  margin-bottom: clamp(2.5rem, 6vw, 4.5rem);
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.4rem;
}
.games-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2.2rem, 6vw, 4.8rem);
  line-height: 1;
  letter-spacing: -0.02em;
}
.games-title em {
  font-style: italic;
  color: var(--fg-dim);
}
.games-title mark {
  background: none;
  color: var(--accent);
}
.games-lead {
  margin-top: 1.6rem;
  max-width: 46ch;
  color: var(--fg-dim);
  font-size: clamp(0.95rem, 1.4vw, 1.1rem);
}

/* escenario de personajes */
.games-stage {
  position: relative;
  min-height: clamp(320px, 46vw, 560px);
  display: grid;
  place-items: center;
  margin-bottom: clamp(2.5rem, 6vw, 4rem);
}

.stage-ring {
  position: absolute;
  bottom: 4%;
  left: 50%;
  width: min(560px, 80%);
  aspect-ratio: 1;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(214, 255, 63, 0.1),
    rgba(214, 255, 63, 0.03) 40%,
    transparent 62%
  );
  filter: blur(2px);
}
.stage-ring::after {
  content: '';
  position: absolute;
  inset: 18% 6% 40% 6%;
  border-radius: 50%;
  border: 1px solid rgba(214, 255, 63, 0.22);
  box-shadow: 0 0 40px rgba(214, 255, 63, 0.12);
}

.stage-scan {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent 0 3px,
    rgba(255, 255, 255, 0.02) 3px 4px
  );
  mask-image: radial-gradient(70% 70% at 50% 55%, #000, transparent 75%);
  -webkit-mask-image: radial-gradient(70% 70% at 50% 55%, #000, transparent 75%);
}

.stage-chars {
  position: relative;
  z-index: 2;
  width: min(1080px, 100%);
  height: auto;
  object-fit: contain;
  /* fondo negro solido -> fundir bordes con la seccion */
  -webkit-mask-image: radial-gradient(
    115% 118% at 50% 46%,
    #000 52%,
    transparent 82%
  );
  mask-image: radial-gradient(115% 118% at 50% 46%, #000 52%, transparent 82%);
  transition: transform 0.5s var(--ease);
  will-change: transform;
}

.stage-floor {
  position: absolute;
  bottom: clamp(1.5rem, 4vw, 3rem);
  left: 50%;
  width: min(620px, 88%);
  height: 42px;
  transform: translateX(-50%);
  background: radial-gradient(
    50% 100% at 50% 0%,
    rgba(0, 0, 0, 0.55),
    transparent 70%
  );
  z-index: 1;
}

/* placeholder si falta la imagen */
.stage-placeholder {
  position: relative;
  z-index: 2;
  width: min(560px, 90%);
  height: clamp(320px, 46vw, 560px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6%;
}
.ph-a,
.ph-b {
  width: 26%;
  border-radius: 120px 120px 20px 20px;
  background: linear-gradient(180deg, var(--bg-soft), transparent);
  border: 1px dashed var(--line);
}
.ph-a {
  height: 82%;
  border-color: rgba(255, 92, 56, 0.4);
}
.ph-b {
  height: 92%;
  border-color: rgba(214, 255, 63, 0.4);
}
.ph-note {
  position: absolute;
  bottom: -2.6rem;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--fg-dim);
  font-size: 0.8rem;
}
.ph-note code {
  color: var(--accent);
  font-family: var(--font-display);
}

/* HUD */
.badge,
.chip {
  position: absolute;
  z-index: 3;
  font-family: var(--font-display);
  pointer-events: none;
}
.badge {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--accent);
  border-radius: 10px;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(10, 10, 12, 0.4);
  backdrop-filter: blur(4px);
}
.badge-tl {
  top: 8%;
  left: 8%;
  animation: float 5s var(--ease) infinite;
}
.badge-tr {
  top: 14%;
  right: 8%;
  animation: float 6s var(--ease) infinite reverse;
}
.chip {
  padding: 0.4rem 0.8rem;
  border-radius: 100px;
  border: 1px solid var(--line);
  background: rgba(10, 10, 12, 0.5);
  backdrop-filter: blur(6px);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
}
.chip-1 {
  top: 34%;
  right: 4%;
  color: var(--accent);
  border-color: rgba(214, 255, 63, 0.3);
  animation: float 7s var(--ease) infinite;
}
.chip-2 {
  bottom: 20%;
  left: 3%;
  animation: float 6.5s var(--ease) infinite reverse;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.games-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1.6rem;
  padding-top: clamp(1.5rem, 4vw, 2.5rem);
  border-top: 1px solid var(--line);
}
.tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
}
.tags li {
  padding: 0.5rem 1rem;
  border: 1px solid var(--line);
  border-radius: 100px;
  font-size: 0.85rem;
  color: var(--fg-dim);
  transition: border-color 0.3s var(--ease), color 0.3s var(--ease);
}
.tags li:hover {
  border-color: var(--accent);
  color: var(--fg);
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
  transition: background 0.3s var(--ease), color 0.3s var(--ease), gap 0.3s var(--ease);
}
.cta:hover {
  background: var(--accent);
  color: #000;
  gap: 18px;
}

/* botón Play */
.play-btn {
  position: absolute;
  z-index: 4;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  padding: 1rem 1.7rem 1rem 1.3rem;
  border: none;
  border-radius: 100px;
  background: var(--accent);
  color: #000;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1rem, 2vw, 1.25rem);
  cursor: pointer;
  box-shadow: 0 12px 40px rgba(214, 255, 63, 0.35);
  transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease);
}
.play-btn:hover {
  transform: translate(-50%, -50%) scale(1.06);
  box-shadow: 0 16px 54px rgba(214, 255, 63, 0.5);
}
.play-ico {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #000;
  color: var(--accent);
  font-size: 0.8rem;
  padding-left: 2px;
}
.play-pulse {
  position: absolute;
  inset: 0;
  border-radius: 100px;
  border: 2px solid var(--accent);
  animation: play-ring 2s ease-out infinite;
  pointer-events: none;
}
@keyframes play-ring {
  0% { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(1.5); opacity: 0; }
}

@media (max-width: 720px) {
  .badge-tr,
  .chip-1,
  .chip-2 {
    display: none;
  }
  .games-foot {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
