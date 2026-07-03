<script setup>
import VideoCard from './VideoCard.vue'

// 8 videos en /public/videos. Titulos/tags editables.
const projects = [
  { title: 'Neon Drift', tag: 'Motion' },
  { title: 'Ciudad Líquida', tag: 'Reel' },
  { title: 'Eco Visual', tag: 'Marca' },
  { title: 'Ritmo Urbano', tag: 'Música' },
  { title: 'Materia Oscura', tag: '3D' },
  { title: 'Fragmentos', tag: 'Corto' },
  { title: 'Luz de Sodio', tag: 'Color' },
  { title: 'Última Toma', tag: 'Film' },
].map((p, i) => ({ ...p, src: `/videos/${i + 1}.mp4` }))
</script>

<template>
  <section id="work" class="work">
    <div class="container">
      <header class="work-head">
        <p class="eyebrow reveal">// Trabajo seleccionado</p>
        <h2 class="work-title reveal" data-reveal-delay="80">
          Ocho piezas.<br /><span>Un mismo pulso.</span>
        </h2>
        <p class="work-sub reveal" data-reveal-delay="160">
          Cosas que hacemos cuando nos dejan crear. Pasa el cursor para verlas.
        </p>
      </header>

      <div class="grid">
        <VideoCard
          v-for="(p, i) in projects"
          :key="i"
          :index="i"
          :src="p.src"
          :title="p.title"
          :tag="p.tag"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.work {
  position: relative;
  padding: clamp(5rem, 12vw, 11rem) 0;
}

.work-head {
  max-width: 720px;
  margin-bottom: clamp(3rem, 7vw, 6rem);
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.4rem;
}
.work-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2.4rem, 6vw, 5rem);
  line-height: 0.98;
  letter-spacing: -0.02em;
}
.work-title span {
  color: var(--fg-dim);
}
.work-sub {
  margin-top: 1.5rem;
  color: var(--fg-dim);
  font-size: 1.05rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(1.6rem, 3vw, 3.2rem) clamp(1.4rem, 2.5vw, 2.6rem);
}

/* stagger sizes for a more editorial layout */
.grid > :nth-child(3n + 1) {
  grid-column: span 2;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
  .grid > :nth-child(3n + 1) {
    grid-column: span 2;
  }
}
@media (max-width: 620px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .grid > * {
    grid-column: span 1 !important;
  }
}
</style>
