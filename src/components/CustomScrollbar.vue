<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

// Scrollbar custom: thumb que se estira según la velocidad (elástico),
// draggable, y usa Lenis para el scrollTo si está disponible.
const props = defineProps({
  lenis: { type: Object, default: null },
})

const trackEl = ref(null)
const thumbEl = ref(null)
const visible = ref(false)
const dragging = ref(false)

let raf = null
let lastY = 0
let velSmooth = 0
let hideTimer = null

function frame() {
  const track = trackEl.value
  const thumb = thumbEl.value
  if (track && thumb) {
    const winH = window.innerHeight
    const docH = document.documentElement.scrollHeight
    const y = window.scrollY
    const limit = docH - winH
    const prog = limit > 0 ? Math.min(Math.max(y / limit, 0), 1) : 0

    const trackH = track.clientHeight
    const thumbH = Math.max(trackH * (winH / docH), 54)
    const ty = prog * (trackH - thumbH)

    // velocidad suavizada -> estiramiento elástico
    velSmooth += (y - lastY - velSmooth) * 0.25
    lastY = y
    const stretch = Math.min(Math.abs(velSmooth) * 0.03, 0.55)
    const scale = 1 + stretch
    const origin = velSmooth >= 0 ? 'top center' : 'bottom center'

    thumb.style.height = thumbH + 'px'
    thumb.style.transform = `translateY(${ty}px) scaleY(${scale})`
    thumb.style.transformOrigin = origin
  }
  raf = requestAnimationFrame(frame)
}

// mostrar al scrollear, ocultar tras inactividad
function poke() {
  visible.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (!dragging.value) visible.value = false
  }, 1400)
}

// arrastre del thumb
function scrollToClientY(clientY) {
  const track = trackEl.value
  if (!track) return
  const r = track.getBoundingClientRect()
  let f = (clientY - r.top) / r.height
  f = Math.min(Math.max(f, 0), 1)
  const limit = document.documentElement.scrollHeight - window.innerHeight
  const target = f * limit
  if (props.lenis) props.lenis.scrollTo(target, { immediate: true })
  else window.scrollTo(0, target)
}

function onThumbDown(e) {
  dragging.value = true
  visible.value = true
  thumbEl.value.setPointerCapture?.(e.pointerId)
  e.preventDefault()
}
function onTrackDown(e) {
  // click en el track salta a esa posición
  if (e.target === thumbEl.value) return
  scrollToClientY(e.clientY)
}
function onMove(e) {
  if (!dragging.value) return
  scrollToClientY(e.clientY)
}
function onUp() {
  dragging.value = false
  poke()
}

onMounted(() => {
  lastY = window.scrollY
  frame()
  window.addEventListener('scroll', poke, { passive: true })
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  poke()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(hideTimer)
  window.removeEventListener('scroll', poke)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
})
</script>

<template>
  <div
    ref="trackEl"
    class="scrollbar"
    :class="{ visible: visible || dragging, dragging }"
    @pointerdown="onTrackDown"
    @mouseenter="visible = true"
  >
    <div
      ref="thumbEl"
      class="thumb"
      data-cursor="hover"
      @pointerdown.stop="onThumbDown"
    ></div>
  </div>
</template>

<style scoped>
.scrollbar {
  position: fixed;
  top: 14px;
  bottom: 14px;
  right: 8px;
  width: 10px;
  z-index: 9996;
  border-radius: 20px;
  cursor: pointer;
  opacity: 0;
  transform: translateX(6px);
  transition: opacity 0.4s var(--ease), transform 0.4s var(--ease),
    width 0.3s var(--ease);
}
.scrollbar.visible {
  opacity: 1;
  transform: translateX(0);
}
.scrollbar::before {
  content: '';
  position: absolute;
  inset: 0 4px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
}
.scrollbar:hover,
.scrollbar.dragging {
  width: 14px;
}

.thumb {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  margin: 0 2px;
  border-radius: 20px;
  background: linear-gradient(180deg, var(--accent), #a6d400);
  box-shadow: 0 0 14px rgba(214, 255, 63, 0.35);
  will-change: transform, height;
}
.scrollbar.dragging .thumb,
.scrollbar:hover .thumb {
  background: linear-gradient(180deg, #e6ff6b, var(--accent));
  box-shadow: 0 0 22px rgba(214, 255, 63, 0.6);
}

@media (hover: none) {
  .scrollbar {
    display: none;
  }
}
</style>
