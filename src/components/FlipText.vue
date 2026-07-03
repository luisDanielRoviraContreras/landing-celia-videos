<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// Port a Vue del FlipText: cada carácter hace flip 3D al entrar.
// Cicla por una lista de frases (ej: rol -> correo -> rol -> correo).
const props = defineProps({
  words: { type: Array, required: true },
  interval: { type: Number, default: 2600 }, // ms visible por frase
  duration: { type: Number, default: 0.7 }, // seg del flip por carácter
  stagger: { type: Number, default: 0.028 }, // seg entre caracteres
})

const idx = ref(0)
const current = computed(() => props.words[idx.value % props.words.length])
const chars = computed(() => [...current.value])

let timer = null
onMounted(() => {
  timer = setInterval(() => {
    idx.value = (idx.value + 1) % props.words.length
  }, props.interval)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <span class="flip" :style="{ perspective: '1200px' }">
    <!-- :key fuerza re-montaje al cambiar de frase -> re-dispara el flip -->
    <span :key="idx" class="flip-word">
      <span
        v-for="(c, i) in chars"
        :key="i"
        class="flip-char"
        :style="{
          '--fc-delay': i * stagger + 's',
          '--fc-dur': duration + 's',
        }"
        >{{ c === ' ' ? ' ' : c }}</span
      >
    </span>
  </span>
</template>

<style scoped>
.flip {
  display: inline-block;
  transform-style: preserve-3d;
}
.flip-word {
  display: inline-block;
  transform-style: preserve-3d;
}
.flip-char {
  display: inline-block;
  transform-origin: 50% 100%;
  backface-visibility: hidden;
  animation: flipIn var(--fc-dur, 0.7s) cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: var(--fc-delay, 0s);
  will-change: transform, opacity;
}
@keyframes flipIn {
  0% {
    transform: rotateX(-95deg) translateY(0.35em);
    opacity: 0;
    filter: blur(3px);
  }
  60% {
    opacity: 1;
    filter: blur(0);
  }
  100% {
    transform: rotateX(0) translateY(0);
    opacity: 1;
    filter: blur(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .flip-char {
    animation: none;
  }
}
</style>
