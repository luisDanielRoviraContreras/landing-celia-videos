<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const dot = ref(null)
const ring = ref(null)

let mouseX = 0, mouseY = 0
let ringX = 0, ringY = 0
let raf = null
const hovering = ref(false)
const clicking = ref(false)

function onMove(e) {
  mouseX = e.clientX
  mouseY = e.clientY
  if (dot.value) {
    dot.value.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`
  }
  // detect interactive targets
  const el = e.target
  hovering.value = !!el.closest('a, button, [data-cursor="hover"]')
}

function loop() {
  ringX += (mouseX - ringX) * 0.18
  ringY += (mouseY - ringY) * 0.18
  if (ring.value) {
    ring.value.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`
  }
  raf = requestAnimationFrame(loop)
}

const onDown = () => (clicking.value = true)
const onUp = () => (clicking.value = false)

onMounted(() => {
  if (window.matchMedia('(hover: none)').matches) return
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mousedown', onDown)
  window.addEventListener('mouseup', onUp)
  loop()
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mousedown', onDown)
  window.removeEventListener('mouseup', onUp)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <div class="cursor-layer" aria-hidden="true">
    <div ref="dot" class="cursor-dot" :class="{ click: clicking }"></div>
    <div
      ref="ring"
      class="cursor-ring"
      :class="{ hover: hovering, click: clicking }"
    ></div>
  </div>
</template>

<style scoped>
.cursor-layer {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

.cursor-dot,
.cursor-ring {
  position: fixed;
  top: 0;
  left: 0;
  border-radius: 50%;
  pointer-events: none;
  transform: translate3d(-100px, -100px, 0);
}

.cursor-dot {
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  background: var(--accent);
  transition: width 0.2s var(--ease), height 0.2s var(--ease);
}
.cursor-dot.click {
  width: 3px;
  height: 3px;
}

.cursor-ring {
  width: 38px;
  height: 38px;
  margin: -19px 0 0 -19px;
  border: 1.5px solid rgba(242, 240, 235, 0.5);
  transition: width 0.28s var(--ease), height 0.28s var(--ease),
    border-color 0.28s var(--ease), background 0.28s var(--ease);
}
.cursor-ring.hover {
  width: 64px;
  height: 64px;
  margin: -32px 0 0 -32px;
  border-color: var(--accent);
  background: rgba(214, 255, 63, 0.08);
}
.cursor-ring.click {
  width: 28px;
  height: 28px;
  margin: -14px 0 0 -14px;
}

@media (hover: none) {
  .cursor-layer {
    display: none;
  }
}
</style>
