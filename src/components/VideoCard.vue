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

// tilt on mouse move
const tilt = ref({ rx: 0, ry: 0 })
function onTilt(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const px = (e.clientX - r.left) / r.width - 0.5
  const py = (e.clientY - r.top) / r.height - 0.5
  tilt.value = { rx: (-py * 6).toFixed(2), ry: (px * 6).toFixed(2) }
}
function resetTilt() {
  tilt.value = { rx: 0, ry: 0 }
}
</script>

<template>
  <article
    ref="cardEl"
    class="card reveal"
    :data-reveal-delay="(index % 3) * 90"
    data-cursor="hover"
    :style="{ transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }"
    @mouseenter="play"
    @mouseleave="() => { stop(); resetTilt() }"
    @mousemove="onTilt"
  >
    <div class="card-num">{{ String(index + 1).padStart(2, '0') }}</div>

    <div class="media" :class="{ playing: isPlaying }">
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
      <div class="play-hint">
        <span class="play-icon">▶</span>
        <span>Hover para reproducir</span>
      </div>
    </div>

    <div class="card-meta">
      <h3 class="card-title">{{ title }}</h3>
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
}

.media video {
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
  background: linear-gradient(
    180deg,
    rgba(10, 10, 12, 0) 40%,
    rgba(10, 10, 12, 0.55) 100%
  );
  pointer-events: none;
}

.play-hint {
  position: absolute;
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
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  letter-spacing: -0.01em;
}
.card-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--fg-dim);
  white-space: nowrap;
}
</style>
