<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Lenis from 'lenis'
import { useScrollReveal } from './composables/useScrollReveal'
import CrayonCursor from './components/CrayonCursor.vue'
import ScrambleHover from './components/ScrambleHover.vue'
import CustomScrollbar from './components/CustomScrollbar.vue'
import HeroSection from './components/HeroSection.vue'
import MarqueeStrip from './components/MarqueeStrip.vue'
import WorkGallery from './components/WorkGallery.vue'
import ScrollText from './components/ScrollText.vue'
import BannerShowcase from './components/BannerShowcase.vue'
import ParallaxGallery from './components/ParallaxGallery.vue'
import ProjectionScene from './components/ProjectionScene.vue'
import Scene3D from './components/Scene3D.vue'
import Capabilities from './components/Capabilities.vue'
import HorizontalReel from './components/HorizontalReel.vue'
import AboutSection from './components/AboutSection.vue'
import HyperScroll from './components/HyperScroll.vue'
import ContactSection from './components/ContactSection.vue'
import GradualBlur from './components/GradualBlur.vue'

const root = ref(null)
useScrollReveal(root)

const progress = ref(0)
const scrolled = ref(false)
const lenis = ref(null)

let lenisInstance = null
let lenisRaf = null

function onScroll() {
  const h = document.documentElement
  const max = h.scrollHeight - h.clientHeight
  progress.value = max > 0 ? (h.scrollTop / max) * 100 : 0
  scrolled.value = h.scrollTop > 40
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // smooth scroll con Lenis (salvo que el usuario prefiera menos movimiento)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!reduce) {
    lenisInstance = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 1,
      smoothWheel: true,
      touchMultiplier: 1.6,
    })
    const raf = (time) => {
      lenisInstance.raf(time)
      lenisRaf = requestAnimationFrame(raf)
    }
    lenisRaf = requestAnimationFrame(raf)
    lenis.value = lenisInstance
  }

  document.addEventListener('click', onAnchorClick)
})

// links internos (#work, #top...) con scroll suave de Lenis
function onAnchorClick(e) {
  const a = e.target.closest('a[href^="#"]')
  if (!a) return
  const href = a.getAttribute('href')
  if (!href || href === '#') return
  const target = href === '#top' ? 0 : document.querySelector(href)
  if (target === null) return
  e.preventDefault()
  if (lenisInstance) lenisInstance.scrollTo(target, { offset: -10, duration: 1.1 })
  else if (target === 0) window.scrollTo(0, 0)
  else target.scrollIntoView({ behavior: 'smooth' })
}

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', onAnchorClick)
  cancelAnimationFrame(lenisRaf)
  lenisInstance?.destroy()
})
</script>

<template>
  <div ref="root" id="top">
    <CrayonCursor />
    <ScrambleHover />
    <CustomScrollbar :lenis="lenis" />

    <div class="progress" :style="{ transform: `scaleX(${progress / 100})` }"></div>

    <header class="nav" :class="{ solid: scrolled }">
      <a href="#top" class="brand" data-cursor="hover">
        LR<span class="brand-dot">.</span>
      </a>
      <nav class="nav-links">
        <a href="#work" data-cursor="hover">Trabajo</a>
        <a href="#about" data-cursor="hover">Sobre mí</a>
        <a href="#contact" class="nav-cta" data-cursor="hover">Contacto</a>
      </nav>
    </header>

    <main>
      <HeroSection />
      <ProjectionScene />
      <MarqueeStrip />
      <WorkGallery />
      <ScrollText />
      <BannerShowcase />
      <ParallaxGallery />
      <Scene3D />
      <Capabilities />
      <HorizontalReel />
      <AboutSection />
      <HyperScroll />
      <ContactSection />
    </main>

    <GradualBlur
      target="page"
      position="bottom"
      height="7rem"
      :strength="2.5"
      :div-count="6"
      curve="bezier"
      :z-index="90"
    />
  </div>
</template>

<style scoped>
.progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  z-index: 9997;
  background: var(--accent);
  transform-origin: left;
  transform: scaleX(0);
}

.nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  /* sobre las secciones ancladas (.pin z 200) para que no lo cubran */
  z-index: 9990;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.4rem clamp(1.2rem, 5vw, 3rem);
  transition: background 0.4s var(--ease), backdrop-filter 0.4s var(--ease),
    border-color 0.4s var(--ease), padding 0.4s var(--ease);
  border-bottom: 1px solid transparent;
}
.nav.solid {
  background: rgba(10, 10, 12, 0.6);
  backdrop-filter: blur(14px);
  border-bottom-color: var(--line);
  padding-block: 1rem;
}

.brand {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
}
.brand-dot {
  color: var(--accent);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: clamp(1rem, 2.5vw, 2.2rem);
  font-size: 0.95rem;
}
.nav-links a {
  color: var(--fg-dim);
  transition: color 0.3s var(--ease);
}
.nav-links a:hover {
  color: var(--fg);
}
.nav-cta {
  padding: 0.5rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 100px;
  color: var(--fg) !important;
  transition: border-color 0.3s var(--ease), background 0.3s var(--ease);
}
.nav-cta:hover {
  border-color: var(--accent);
  background: rgba(214, 255, 63, 0.08);
}

@media (max-width: 560px) {
  .nav-links a:not(.nav-cta) {
    display: none;
  }
}
</style>
