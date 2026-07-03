<script setup>
const words = ['Creatividad', 'Video', 'Imagen', 'Motion', 'Velocidad', 'Marca', 'IA', 'Dirección']
</script>

<template>
  <div class="marquee" aria-hidden="true">
    <div class="track">
      <template v-for="n in 2" :key="n">
        <span v-for="(w, i) in words" :key="n + '-' + i" class="item">
          {{ w }} <i class="star">✦</i>
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.marquee {
  overflow: hidden;
  border-block: 1px solid var(--line);
  padding: 1.4rem 0;
  background: var(--bg-soft);
}
.track {
  display: flex;
  gap: 2.4rem;
  width: max-content;
  animation: scroll 26s linear infinite;
}
.marquee:hover .track {
  animation-play-state: paused;
}
.item {
  display: inline-flex;
  align-items: center;
  gap: 2.4rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.4rem, 3.5vw, 2.6rem);
  letter-spacing: -0.01em;
  color: var(--fg);
  white-space: nowrap;
}
.star {
  color: var(--accent);
  font-style: normal;
  font-size: 0.6em;
}
@keyframes scroll {
  to {
    transform: translateX(-50%);
  }
}
</style>
