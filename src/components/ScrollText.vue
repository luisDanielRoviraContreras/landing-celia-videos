<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

// Texto largo revelado por scroll. Varios párrafos; cada palabra
// se enciende al bajar y el bloque se esconde al final.
const eyebrow = '// Manifiesto'

const paragraphs = [
  'Nos encanta crear. Ideas que se sienten, que se mueven, que la gente recuerda. Ese es el juego.',
  'Somos rápidos sin sacrificar el gusto. Iteramos, probamos y afinamos hasta que la pieza queda como debe. Nos importa el resultado final, no el proceso perfecto.',
  'Video, imagen, marca, motion. Y sí, usamos IA como superpoder para llegar más lejos y más rápido — pero la mirada, el criterio y el gusto siguen siendo nuestros.',
  'Si tienes una idea y quieres verla hecha realidad, hablemos.',
]

// palabras con índice global para ordenar el reveal
const paras = computed(() => {
  let g = 0
  return paragraphs.map((p) =>
    p.split(' ').map((w) => ({ w, i: g++ }))
  )
})
const totalWords = computed(() =>
  paras.value.reduce((a, p) => a + p.length, 0)
)

const sectionEl = ref(null)
const wordEls = ref([])
const blockEl = ref(null)
let raf = null

function onScroll() {
  if (!raf) raf = requestAnimationFrame(apply)
}
function apply() {
  const el = sectionEl.value
  if (el) {
    const r = el.getBoundingClientRect()
    const total = r.height - window.innerHeight
    const p = Math.min(Math.max(-r.top, 0), total) / (total || 1)

    const revealSpan = 0.5
    const n = totalWords.value
    wordEls.value.forEach((w, i) => {
      if (!w) return
      const start = (i / n) * revealSpan
      const end = start + (revealSpan / n) * 3.2 // solape mayor = relleno más rápido
      let t = (p - start) / (end - start)
      t = Math.min(Math.max(t, 0), 1)
      w.style.opacity = (0.12 + t * 0.88).toFixed(3)
      w.style.transform = `translateY(${(1 - t) * 16}px)`
      w.style.filter = `blur(${(1 - t) * 3}px)`
    })

    const hide = Math.min(Math.max((p - 0.86) / 0.14, 0), 1)
    if (blockEl.value) {
      blockEl.value.style.opacity = (1 - hide).toFixed(3)
      blockEl.value.style.transform = `translateY(${-hide * 70}px) scale(${1 - hide * 0.05})`
    }
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
  <section ref="sectionEl" class="scrolltext">
    <div class="pin">
      <div ref="blockEl" class="block container">
        <p class="eyebrow">{{ eyebrow }}</p>

        <p
          v-for="(para, pi) in paras"
          :key="pi"
          class="para"
          :class="pi === 0 ? 'lead' : 'body'"
        >
          <span
            v-for="item in para"
            :key="item.i"
            class="word"
            :ref="(el) => (wordEls[item.i] = el)"
            >{{ item.w }}&nbsp;</span
          >
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scrolltext {
  position: relative;
  height: 260vh;
  border-top: 1px solid var(--line);
  background:
    radial-gradient(70% 60% at 50% 45%, rgba(214, 255, 63, 0.05), transparent 70%),
    var(--bg);
}
.pin {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.block {
  width: min(1120px, 90vw);
  will-change: transform, opacity;
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 2rem;
}
.para {
  font-family: var(--font-display);
  letter-spacing: -0.015em;
}
.lead {
  font-weight: 600;
  font-size: clamp(1.7rem, 4.6vw, 3.8rem);
  line-height: 1.12;
  margin-bottom: 1.6rem;
}
.body {
  font-weight: 500;
  font-size: clamp(1.05rem, 2.4vw, 1.9rem);
  line-height: 1.35;
  margin-bottom: 1.2rem;
  max-width: 40ch;
}
.body:last-child {
  color: var(--fg);
  margin-bottom: 0;
}
.word {
  display: inline-block;
  opacity: 0.12;
  will-change: opacity, transform, filter;
}
/* acentos */
.lead .word:nth-child(5),
.lead .word:nth-child(6),
.lead .word:nth-child(15) {
  color: var(--accent);
}
.body:last-child .word:last-child {
  color: var(--accent);
}

@media (max-width: 620px) {
  .body {
    max-width: none;
  }
}
</style>
