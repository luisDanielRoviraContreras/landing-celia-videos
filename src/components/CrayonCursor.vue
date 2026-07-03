<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import p5 from 'p5'
import * as brush from 'p5.brush'

// Adaptación de JorgeCapillo/stop-motion-crayon-cursor a un overlay
// transparente para todo el sitio: cursor crayón + trazos al arrastrar.
// (sin el fondo rojo ni el polígono del demo original).
const el = ref(null)

let app = null
let rafId = null
let disposed = false

const state = {
  w: window.innerWidth,
  h: window.innerHeight,
  mouse: { x: { c: -100, t: -100 }, y: { c: -100, t: -100 }, delta: { c: 0, t: 0 } },
  hover: { c: 0, t: 0 },
  trails: [],
  activeTrail: null,
  maxTrail: 400,
  mouseupTO: null,
}

function isTouch() {
  return window.matchMedia('(hover: none)').matches
}

function onResize() {
  state.w = window.innerWidth
  state.h = window.innerHeight
  app?.resizeCanvas(state.w, state.h, true)
}
function onMove(e) {
  state.mouse.x.t = e.clientX
  state.mouse.y.t = e.clientY
  const t = e.target
  state.hover.t = t && t.closest('a, button, [data-cursor="hover"]') ? 1 : 0
}
function onDown() {
  if (state.mouseupTO) clearTimeout(state.mouseupTO)
  const nt = []
  state.trails.push(nt)
  state.activeTrail = nt
}
function onUp() {
  if (state.mouseupTO) clearTimeout(state.mouseupTO)
  state.mouseupTO = setTimeout(() => {
    state.activeTrail = null
  }, 250)
}

function render(time) {
  if (disposed) return
  const m = state.mouse
  m.x.c += (m.x.t - m.x.c) * 0.12
  m.y.c += (m.y.t - m.y.c) * 0.12
  m.delta.t = Math.hypot(m.x.t - m.x.c, m.y.t - m.y.c)
  m.delta.c += (m.delta.t - m.delta.c) * 0.1
  state.hover.c += (state.hover.t - state.hover.c) * 0.1

  if (state.activeTrail) {
    state.activeTrail.push({ x: m.x.c, y: m.y.c })
    if (state.activeTrail.length > state.maxTrail) state.activeTrail.shift()
  }
  // trazos inactivos se desvanecen por la cola (stop-motion)
  state.trails.forEach((tr) => {
    if (tr !== state.activeTrail) tr.shift()
  })
  state.trails = state.trails.filter((tr) => tr && tr.length > 0)

  rafId = requestAnimationFrame(render)
}

function sketch(p) {
  brush.instance(p)
  p.setup = () => {
    p.createCanvas(state.w, state.h, p.WEBGL)
    p.angleMode(p.DEGREES)
    brush.noField()
    brush.set('2B')
    brush.scaleBrushes(window.innerWidth <= 1024 ? 2.5 : 0.9)
  }
  p.draw = () => {
    p.frameRate(30)
    p.clear() // transparente (overlay)
    p.translate(-state.w / 2, -state.h / 2)

    // trazos (crayón accent)
    brush.noFill()
    brush.stroke('#d6ff3f')
    brush.strokeWeight(1 + 0.006 * state.mouse.delta.c)
    brush.setHatch('HB', '#d6ff3f', 1)
    state.trails.forEach((tr) => {
      if (tr.length > 1) brush.spline(tr.map((t) => [t.x, t.y]), 1)
    })

    // cursor crayón (círculo) — verde accent
    brush.noFill()
    brush.stroke('#d6ff3f')
    brush.setHatch('HB', '#d6ff3f', 1)
    brush.hatch(5, 30, { rand: 0.1, continuous: true, gradient: 0.3 })
    const r = 7 + 0.05 * state.mouse.delta.c + state.hover.c * 26
    brush.circle(state.mouse.x.c, state.mouse.y.c, r)
  }
}

onMounted(() => {
  if (isTouch()) return
  app = new p5(sketch, el.value)
  rafId = requestAnimationFrame(render)
  window.addEventListener('resize', onResize)
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mousedown', onDown)
  document.addEventListener('mouseup', onUp)
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('mousemove', onMove)
  document.removeEventListener('mousedown', onDown)
  document.removeEventListener('mouseup', onUp)
  app?.remove()
})
</script>

<template>
  <div ref="el" class="crayon-layer" aria-hidden="true"></div>
</template>

<style scoped>
.crayon-layer {
  position: fixed;
  inset: 0;
  z-index: 9990;
  pointer-events: none;
}
.crayon-layer :deep(canvas) {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
@media (hover: none) {
  .crayon-layer {
    display: none;
  }
}
</style>
