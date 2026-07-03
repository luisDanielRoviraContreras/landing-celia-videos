<script setup>
const stats = [
  { n: '10x', l: 'Más rápido' },
  { n: '300+', l: 'Piezas creadas' },
  { n: '40M', l: 'Views generadas' },
  { n: '∞', l: 'Ganas de crear' },
]
</script>

<template>
  <section id="about" class="about">
    <div class="container grid">
      <div class="left">
        <p class="eyebrow reveal">// Sobre nosotros</p>
        <p class="lead reveal" data-reveal-delay="80">
          Somos un estudio que <span>vive de crear</span>. Rápidos,
          curiosos y obsesionados con que la pieza final quede impecable.
        </p>
        <p class="body reveal" data-reveal-delay="160">
          Video, imagen, marca, motion. Nos gusta probar, iterar y sorprender.
          La IA es una de nuestras herramientas — nos deja llegar más lejos y
          más rápido — pero el gusto y el criterio siguen siendo humanos.
        </p>
      </div>

      <ul class="stats">
        <li
          v-for="(s, i) in stats"
          :key="i"
          class="stat reveal"
          :data-reveal-delay="i * 90"
          data-cursor="hover"
        >
          <span class="stat-n">{{ s.n }}</span>
          <span class="stat-l">{{ s.l }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.about {
  padding: clamp(5rem, 12vw, 10rem) 0;
  border-top: 1px solid var(--line);
}
.grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: clamp(2.5rem, 6vw, 6rem);
  align-items: start;
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 2rem;
}
.lead {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.6rem, 3.5vw, 2.6rem);
  line-height: 1.15;
  letter-spacing: -0.02em;
}
.lead span {
  color: var(--accent);
}
.body {
  margin-top: 1.8rem;
  color: var(--fg-dim);
  font-size: 1.05rem;
  max-width: 46ch;
}

.stats {
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: hidden;
}
.stat {
  background: var(--bg);
  padding: 2rem 1.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: background 0.35s var(--ease);
}
.stat:hover {
  background: var(--bg-soft);
}
.stat-n {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2.4rem, 5vw, 3.6rem);
  line-height: 1;
  color: var(--fg);
}
.stat:hover .stat-n {
  color: var(--accent);
}
.stat-l {
  font-size: 0.85rem;
  color: var(--fg-dim);
  letter-spacing: 0.04em;
}

@media (max-width: 820px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
