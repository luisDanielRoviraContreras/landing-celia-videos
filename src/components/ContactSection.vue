<script setup>
import FlipText from './FlipText.vue'
import Grainient from './Grainient.vue'

const EMAIL = 'luisdanielrovira8@gmail.com'
// cicla: rol -> correo -> rol -> correo ...
const flipWords = [
  'Creativos',
  EMAIL,
  'Rápidos',
  EMAIL,
  'Obsesivos',
  EMAIL,
]

const links = [
  { label: 'Instagram', href: '#' },
  { label: 'Vimeo', href: '#' },
  { label: 'YouTube', href: '#' },
  { label: 'LinkedIn', href: '#' },
]
</script>

<template>
  <section id="contact" class="contact">
    <Grainient class="contact-bg" />
    <div class="container">
      <p class="eyebrow reveal">// Hablemos</p>
      <h2 class="big reveal" data-reveal-delay="80" data-cursor="hover">
        <a :href="`mailto:${EMAIL}`">
          <FlipText :words="flipWords" :interval="2600" :duration="0.7" />
        </a>
      </h2>

      <div class="row reveal" data-reveal-delay="160">
        <a
          v-for="(l, i) in links"
          :key="i"
          :href="l.href"
          class="social"
          data-cursor="hover"
        >
          {{ l.label }}
          <span class="arrow">↗</span>
        </a>
      </div>
    </div>

    <footer class="foot container">
      <span>© {{ new Date().getFullYear() }} Luis Rovira</span>
      <span>Hecho con ganas <span class="heart">♥</span></span>
      <a href="#top" data-cursor="hover">Volver arriba ↑</a>
    </footer>
  </section>
</template>

<style scoped>
.contact {
  padding: clamp(5rem, 12vw, 10rem) 0 2.5rem;
  border-top: 1px solid var(--line);
  position: relative;
  overflow: hidden;
  /* toda la sección de contacto por encima del blur de página (z 190) */
  z-index: 200;
}
.contact-bg {
  z-index: 0;
  opacity: 0.9;
}
.contact .container {
  position: relative;
  z-index: 1;
}
.eyebrow {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 2rem;
}
.big {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(1.7rem, 6vw, 5rem);
  line-height: 1;
  letter-spacing: -0.02em;
  word-break: break-word;
}
.big a {
  display: inline-block;
  transition: transform 0.4s var(--ease);
}
.big a:hover {
  transform: translateX(10px);
}
.big .at {
  color: var(--accent);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2.5rem;
  margin-top: clamp(2.5rem, 6vw, 4rem);
}
.social {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.1rem;
  color: var(--fg-dim);
  transition: color 0.3s var(--ease);
}
.social:hover {
  color: var(--fg);
}
.arrow {
  transition: transform 0.3s var(--ease);
}
.social:hover .arrow {
  transform: translate(3px, -3px);
  color: var(--accent);
}

.heart {
  color: var(--accent);
  display: inline-block;
  animation: heartbeat 1.6s ease-in-out infinite;
}
@keyframes heartbeat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.25); }
  30% { transform: scale(1); }
}

.foot {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  margin-top: clamp(4rem, 10vw, 8rem);
  padding-top: 2rem;
  border-top: 1px solid var(--line);
  font-size: 0.85rem;
  color: var(--fg-dim);
  /* por encima del blur (z 190) para que el efecto no lo difumine */
  position: relative;
  z-index: 300;
}
</style>
