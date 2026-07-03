<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { gsap } from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrambleTextPlugin, SplitText)

// Efecto scramble (GSAP) en hover para títulos y párrafos de la web.
// Manager global: parte el texto en chars y, al pasar el cursor cerca,
// hace scramble de las letras dentro del radio. Solo escanea targets
// próximos al cursor (perf).
const RADIUS = 110
const DURATION = 1.1
const SPEED = 0.55
const CHARS = '.:'

// selectores de texto plano (excluye los ya animados: hero, manifiesto, flip)
const SELECTOR = [
  '.eyebrow',
  '.work-title', '.work-sub',
  '.card-title', '.card-tag',
  '.banner-title', '.banner-text',
  '.scene-title', '.step-t', '.step-d',
  '.caps-title', '.row-title', '.row-meta',
  '.hreel-title', '.panel-title', '.panel-desc',
  '.pg-title',
  '.about .lead', '.about .body', '.stat-l',
].join(',')

const splits = []
let targets = []
let pointer = { x: -9999, y: -9999 }
let raf = null
let pending = false

function buildTargets() {
  const els = document.querySelectorAll(SELECTOR)
  els.forEach((el) => {
    if (el.dataset.scrDone) return
    // evita texto reactivo / que se re-renderiza
    if (el.closest('.flip, .scrolltext, .hero-title')) return
    const split = new SplitText(el, { type: 'chars', charsClass: 'scr-char' })
    split.chars.forEach((c) => {
      c.dataset.content = c.innerHTML
    })
    splits.push(split)
    targets.push({ el, chars: split.chars })
    el.dataset.scrDone = '1'
  })
}

function onMove(e) {
  pointer.x = e.clientX
  pointer.y = e.clientY
  if (!pending) {
    pending = true
    raf = requestAnimationFrame(process)
  }
}

function process() {
  pending = false
  const px = pointer.x
  const py = pointer.y
  for (const t of targets) {
    const r = t.el.getBoundingClientRect()
    // ¿el cursor está cerca del bloque? (radio expandido)
    if (
      px < r.left - RADIUS ||
      px > r.right + RADIUS ||
      py < r.top - RADIUS ||
      py > r.bottom + RADIUS
    )
      continue
    for (const c of t.chars) {
      const cr = c.getBoundingClientRect()
      const dx = px - (cr.left + cr.width / 2)
      const dy = py - (cr.top + cr.height / 2)
      const dist = Math.hypot(dx, dy)
      if (dist < RADIUS) {
        gsap.to(c, {
          overwrite: true,
          duration: DURATION * (1 - dist / RADIUS),
          scrambleText: {
            text: c.dataset.content || '',
            chars: CHARS,
            speed: SPEED,
          },
          ease: 'none',
        })
      }
    }
  }
}

onMounted(() => {
  // dos frames: deja que las secciones monten su DOM antes de partir el texto
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      buildTargets()
      window.addEventListener('pointermove', onMove, { passive: true })
    })
  )
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onMove)
  cancelAnimationFrame(raf)
  splits.forEach((s) => s.revert())
  splits.length = 0
  targets = []
})
</script>

<template>
  <span aria-hidden="true" style="display: none"></span>
</template>
