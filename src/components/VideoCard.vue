<script setup>
import { ref } from 'vue'

const props = defineProps({
  index: { type: Number, required: true },
  src: { type: String, required: true },
  title: { type: String, required: true },
  tag: { type: String, default: '' },
})

const cardEl = ref(null)
const videoEl = ref(null)
const isPlaying = ref(false)
const isLoaded = ref(false)

function play() {
  const v = videoEl.value
  if (!v) return
  v.play().then(() => (isPlaying.value = true)).catch(() => {})
}

function stop() {
  const v = videoEl.value
  if (!v) return
  v.pause()
  v.currentTime = 0
  isPlaying.value = false
}

// tilt + cursor-tracked spotlight
const tilt = ref({ rx: 0, ry: 0 })
const pointer = ref({ x: 50, y: 50 })
function onTilt(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const nx = (e.clientX - r.left) / r.width
  const ny = (e.clientY - r.top) / r.height
  tilt.value = { rx: (-(ny - 0.5) * 8).toFixed(2), ry: ((nx - 0.5) * 8).toFixed(2) }
  pointer.value = { x: (nx * 100).toFixed(1), y: (ny * 100).toFixed(1) }
}
function resetTilt() {
  tilt.value = { rx: 0, ry: 0 }
  pointer.value = { x: 50, y: 50 }
}
</script>

<template>
  <article
    ref="cardEl"
    class="card reveal"
    :data-reveal-delay="(index % 3) * 90"
    data-cursor="hover"
    :style="{
      transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
      '--mx': pointer.x + '%',
      '--my': pointer.y + '%',
    }"
    @mouseenter="play"
    @mouseleave="() => { stop(); resetTilt() }"
    @mousemove="onTilt"
  >
    <div class="card-num">{{ String(index + 1).padStart(2, '0') }}</div>

    <div class="media" :class="{ playing: isPlaying }">
      <span class="ring" aria-hidden="true"></span>
      <video
        ref="videoEl"
        :src="src"
        muted
        loop
        playsinline
        preload="metadata"
        @loadeddata="isLoaded = true"
      ></video>
      <div class="scrim"></div>
      <span class="spotlight" aria-hidden="true"></span>
      <span class="shine" aria-hidden="true"></span>
      <div class="play-hint">
        <span class="play-icon">▶</span>
        <span>Hover para reproducir</span>
      </div>
    </div>

    <div class="card-meta">
      <h3 class="card-title">
        <span class="title-text">{{ title }}</span>
        <span class="title-arrow" aria-hidden="true">↗</span>
      </h3>
      <span v-if="tag" class="card-tag">{{ tag }}</span>
    </div>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: transform 0.25s var(--ease);
  transform-style: preserve-3d;
}

.card-num {
  position: absolute;
  top: -14px;
  left: -6px;
  z-index: 3;
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.4rem);
  font-weight: 800;
  color: transparent;
  -webkit-text-stroke: 1px rgba(242, 240, 235, 0.25);
  pointer-events: none;
  transition: color 0.4s var(--ease), -webkit-text-stroke 0.4s var(--ease);
}
.card:hover .card-num {
  color: var(--accent);
  -webkit-text-stroke: 1px transparent;
}

.media {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 14px;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  transition: box-shadow 0.5s var(--ease), border-color 0.5s var(--ease);
}
.card:hover .media {
  border-color: transparent;
  box-shadow: 0 24px 60px -22px rgba(0, 0, 0, 0.7);
}

/* rotating gradient ring behind media, revealed on hover */
.ring {
  position: absolute;
  inset: 0;
  z-index: 4;
  border-radius: 14px;
  padding: 1.5px;
  background: conic-gradient(
    from var(--ring-angle, 0deg),
    transparent 0deg,
    var(--accent) 70deg,
    rgba(242, 240, 235, 0.85) 150deg,
    transparent 230deg,
    var(--accent) 320deg,
    transparent 360deg
  );
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  opacity: 0;
  transition: opacity 0.5s var(--ease);
  pointer-events: none;
}
.card:hover .ring {
  opacity: 1;
  animation: ring-spin 4s linear infinite;
}
@property --ring-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes ring-spin {
  to {
    --ring-angle: 360deg;
  }
}

/* cursor-tracked spotlight */
.spotlight {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    260px circle at var(--mx, 50%) var(--my, 50%),
    color-mix(in srgb, var(--accent) 32%, transparent),
    transparent 62%
  );
  mix-blend-mode: screen;
  transition: opacity 0.4s var(--ease);
}
.card:hover .spotlight {
  opacity: 1;
}

/* diagonal shine sweep on enter */
.shine {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(255, 255, 255, 0.18) 46%,
    transparent 62%
  );
  transform: translateX(-120%);
  transition: transform 0.9s var(--ease);
}
.card:hover .shine {
  transform: translateX(120%);
}

.media video {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
  transition: transform 0.7s var(--ease), filter 0.5s var(--ease);
  filter: grayscale(0.6) brightness(0.75);
}
.card:hover .media video {
  transform: scale(1.06);
  filter: grayscale(0) brightness(1);
}

.scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: linear-gradient(
    180deg,
    rgba(10, 10, 12, 0) 40%,
    rgba(10, 10, 12, 0.55) 100%
  );
  pointer-events: none;
}

.play-hint {
  position: absolute;
  z-index: 5;
  left: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  color: var(--fg);
  opacity: 0.9;
  transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
}
.media.playing .play-hint {
  opacity: 0;
  transform: translateY(8px);
}
.play-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent);
  color: #000;
  font-size: 0.7rem;
  padding-left: 2px;
}

.card-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-left: 2px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  letter-spacing: -0.01em;
}
.title-text {
  background-image: linear-gradient(var(--accent), var(--accent));
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 0% 2px;
  transition: background-size 0.45s var(--ease), color 0.45s var(--ease);
  padding-bottom: 2px;
}
.card:hover .title-text {
  background-size: 100% 2px;
  color: var(--accent);
}
.title-arrow {
  display: inline-block;
  color: var(--accent);
  opacity: 0;
  transform: translate(-6px, 4px);
  transition: opacity 0.4s var(--ease), transform 0.4s var(--ease);
}
.card:hover .title-arrow {
  opacity: 1;
  transform: translate(0, 0);
}
.card-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--fg-dim);
  white-space: nowrap;
}
</style>
