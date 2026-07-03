<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

// 3 banners full-bleed independientes. Reproducen solo en viewport.
const banners = [
  {
    src: '/videos/9.mp4',
    kicker: 'Caso 01',
    title: 'Dirección visual',
    text: 'Del texto a la imagen en minutos. Idea rápida, ejecución fina.',
    align: 'left',
  },
  {
    src: '/videos/10.mp4',
    kicker: 'Caso 02',
    title: 'Mundos & personajes',
    text: 'Arte y atmósferas que no existían. Los imaginamos, los creamos.',
    align: 'right',
  },
  {
    src: '/videos/11.mp4',
    kicker: 'Caso 03',
    title: 'De la idea a la pieza',
    text: 'Concepto, creación, color y montaje. Todo bajo un mismo criterio.',
    align: 'left',
  },
]

const bannerEls = ref([])
const loaded = ref(banners.map(() => false)) // lazy: src solo al acercarse
let io = null
let loadIO = null

// parallax interno del video dentro del banner
let raf = null
function onScroll() {
  if (!raf) raf = requestAnimationFrame(applyParallax)
}
function applyParallax() {
  const vh = window.innerHeight
  bannerEls.value.forEach((el) => {
    if (!el) return
    const r = el.getBoundingClientRect()
    const media = el.querySelector('.banner-video')
    if (!media) return
    const progress = (r.top + r.height / 2 - vh / 2) / vh // -1..1 aprox
    media.style.transform = `translateY(${progress * -10}%) scale(1.2)`
  })
  raf = null
}

onMounted(() => {
  // observer de CARGA: marca src ~800px antes de entrar
  loadIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const i = Number(entry.target.dataset.i)
        if (entry.isIntersecting) {
          loaded.value[i] = true
          loadIO.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '800px 0px' }
  )
  // observer de PLAY: reproduce solo mientras está en pantalla
  io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const v = entry.target.querySelector('video')
        if (!v) return
        if (entry.isIntersecting) v.play().catch(() => {})
        else v.pause()
      })
    },
    { threshold: 0.35 }
  )
  bannerEls.value.forEach((el) => {
    if (!el) return
    loadIO.observe(el)
    io.observe(el)
  })
  window.addEventListener('scroll', onScroll, { passive: true })
  applyParallax()
})

onBeforeUnmount(() => {
  io?.disconnect()
  loadIO?.disconnect()
  window.removeEventListener('scroll', onScroll)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <section class="banners">
    <article
      v-for="(b, i) in banners"
      :key="i"
      class="banner"
      :class="b.align"
      :ref="(el) => (bannerEls[i] = el)"
      :data-i="i"
    >
      <div class="banner-media">
        <video
          class="banner-video"
          :src="loaded[i] ? b.src : undefined"
          muted
          loop
          playsinline
          preload="metadata"
        ></video>
        <div class="banner-scrim"></div>
      </div>

      <div class="banner-content container">
        <p class="banner-kicker reveal">{{ b.kicker }}</p>
        <h2 class="banner-title reveal" data-reveal-delay="80">{{ b.title }}</h2>
        <p class="banner-text reveal" data-reveal-delay="160">{{ b.text }}</p>
      </div>

      <span class="banner-index" aria-hidden="true">
        {{ String(i + 1).padStart(2, '0') }}
      </span>
    </article>
  </section>
</template>

<style scoped>
.banners {
  position: relative;
}

.banner {
  position: relative;
  min-height: 88vh;
  display: flex;
  align-items: center;
  overflow: hidden;
  border-top: 1px solid var(--line);
}

.banner-media {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.banner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.2);
  filter: grayscale(0.45) brightness(0.5) contrast(1.05);
  will-change: transform;
}
.banner-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(10, 10, 12, 0.85) 0%,
    rgba(10, 10, 12, 0.4) 45%,
    rgba(10, 10, 12, 0.15) 100%
  );
}
.banner.right .banner-scrim {
  background: linear-gradient(
    270deg,
    rgba(10, 10, 12, 0.85) 0%,
    rgba(10, 10, 12, 0.4) 45%,
    rgba(10, 10, 12, 0.15) 100%
  );
}

.banner-content {
  position: relative;
  z-index: 2;
  width: min(1320px, 90vw);
}
.banner.right .banner-content {
  text-align: right;
}
.banner-inner {
  max-width: 560px;
}
.banner-kicker {
  font-size: 0.8rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.4rem;
}
.banner-title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2.4rem, 7vw, 6rem);
  line-height: 0.98;
  letter-spacing: -0.02em;
  max-width: 14ch;
}
.banner.right .banner-title {
  margin-left: auto;
}
.banner-text {
  margin-top: 1.6rem;
  color: var(--fg-dim);
  font-size: clamp(1rem, 2vw, 1.2rem);
  max-width: 42ch;
}
.banner.right .banner-text {
  margin-left: auto;
}

.banner-index {
  position: absolute;
  z-index: 2;
  bottom: 6vh;
  right: 5vw;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(4rem, 12vw, 11rem);
  line-height: 1;
  color: transparent;
  -webkit-text-stroke: 1.5px rgba(242, 240, 235, 0.16);
  pointer-events: none;
}
.banner.right .banner-index {
  right: auto;
  left: 5vw;
}

@media (max-width: 720px) {
  .banner {
    min-height: 70vh;
  }
  .banner.right .banner-content,
  .banner.right .banner-title,
  .banner.right .banner-text {
    text-align: left;
    margin-left: 0;
  }
  .banner.right .banner-scrim {
    background: linear-gradient(
      90deg,
      rgba(10, 10, 12, 0.85) 0%,
      rgba(10, 10, 12, 0.4) 45%,
      rgba(10, 10, 12, 0.15) 100%
    );
  }
}
</style>
