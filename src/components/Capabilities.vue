<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const rows = [
  { t: 'Video', m: 'Reels, spots, piezas que retienen' },
  { t: 'Imagen', m: 'Arte, personajes, mundos y atmósferas' },
  { t: 'Marca & dirección', m: 'Identidad y concepto con criterio' },
  { t: 'Motion & post', m: 'Color, montaje, animación, sonido' },
  { t: 'IA aplicada', m: 'Creamos más y más rápido, sin perder gusto' },
]

const hovered = ref(-1)
const pos = ref({ x: 0, y: 0 })

// reveal REACTIVO (parte del :class, no clase externa) — así el re-render
// por hover no borra el estado revelado.
const shown = ref(rows.map(() => false))
const rowEls = ref([])
let io = null

function onMove(e, i) {
  hovered.value = i
  const r = e.currentTarget.getBoundingClientRect()
  pos.value = { x: e.clientX - r.left, y: e.clientY - r.top }
}

onMounted(() => {
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const i = Number(e.target.dataset.i)
        if (e.isIntersecting) {
          shown.value[i] = true
          io.unobserve(e.target)
        }
      })
    },
    { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
  )
  rowEls.value.forEach((el) => el && io.observe(el))
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <section class="caps">
    <div class="container">
      <header class="caps-head">
        <p class="eyebrow reveal">// Capacidades</p>
        <h2 class="caps-title reveal" data-reveal-delay="80">
          Todo lo que<br />ponemos a crear.
        </h2>
      </header>

      <ul class="list">
        <li
          v-for="(r, i) in rows"
          :key="i"
          class="row"
          :ref="(el) => (rowEls[i] = el)"
          :data-i="i"
          :style="{ transitionDelay: i * 55 + 'ms' }"
          :class="{ active: hovered === i, in: shown[i] }"
          data-cursor="hover"
          @mousemove="(e) => onMove(e, i)"
          @mouseleave="hovered = -1"
        >
          <span class="row-index">0{{ i + 1 }}</span>
          <span class="row-title">{{ r.t }}</span>
          <span class="row-meta">{{ r.m }}</span>
          <span class="row-arrow">→</span>

          <span
            v-if="hovered === i"
            class="row-glow"
            :style="{ left: pos.x + 'px', top: pos.y + 'px' }"
          ></span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.caps {
  padding: clamp(5rem, 12vw, 10rem) 0;
  border-top: 1px solid var(--line);
}
.caps-head {
  margin-bottom: clamp(2.5rem, 6vw, 5rem);
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.4rem;
}
.caps-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2rem, 5.5vw, 4.4rem);
  line-height: 1;
  letter-spacing: -0.02em;
}

.list {
  list-style: none;
}
.row {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 1.5rem;
  padding: clamp(1.4rem, 3vw, 2.4rem) 0.5rem;
  border-top: 1px solid var(--line);
  overflow: hidden;
  /* reveal: oculto hasta entrar en viewport */
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.7s var(--ease), transform 0.7s var(--ease),
    padding-left 0.4s var(--ease);
}
.row.in {
  opacity: 1;
  transform: translateY(0);
}
/* barra vertical accent que crece en hover */
.row::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--accent);
  transform: scaleY(0);
  transform-origin: bottom;
  transition: transform 0.45s var(--ease);
}
.row.active::after {
  transform: scaleY(1);
  transform-origin: top;
}
.row:last-child {
  border-bottom: 1px solid var(--line);
}
.row.active {
  padding-left: 1.6rem;
}

.row-index {
  font-family: var(--font-display);
  font-size: 0.9rem;
  color: var(--fg-dim);
  transition: color 0.3s var(--ease);
}
.row-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.4rem, 4vw, 2.8rem);
  letter-spacing: -0.01em;
  transition: color 0.3s var(--ease);
}
.row-meta {
  color: var(--fg-dim);
  font-size: 0.95rem;
  text-align: right;
  opacity: 0.7;
  transition: opacity 0.3s var(--ease), color 0.3s var(--ease);
}
.row-arrow {
  font-size: 1.4rem;
  color: var(--fg-dim);
  transform: translateX(-8px);
  opacity: 0;
  transition: transform 0.3s var(--ease), opacity 0.3s var(--ease),
    color 0.3s var(--ease);
}

.row.active .row-index {
  color: var(--accent);
}
.row.active .row-title {
  color: var(--accent);
}
.row.active .row-meta {
  opacity: 1;
  color: var(--fg);
}
.row.active .row-arrow {
  transform: translateX(0);
  opacity: 1;
  color: var(--accent);
}

.row-glow {
  position: absolute;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(214, 255, 63, 0.14), transparent 65%);
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: -1;
}

@media (max-width: 720px) {
  .row {
    grid-template-columns: auto 1fr auto;
    gap: 0.8rem;
  }
  .row-meta {
    display: none;
  }
}
</style>
