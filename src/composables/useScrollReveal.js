import { onMounted, onBeforeUnmount } from 'vue'

// Adds `.is-visible` to any `.reveal` element when it enters the viewport.
// Supports optional stagger via data-reveal-delay (ms).
export function useScrollReveal(rootRef, { threshold = 0.15, once = true } = {}) {
  let observer = null

  onMounted(() => {
    const root = rootRef?.value ?? document
    const targets = root.querySelectorAll('.reveal')

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const el = entry.target
            const delay = el.dataset.revealDelay || 0
            el.style.transitionDelay = `${delay}ms`
            el.classList.add('is-visible')
            if (once) observer.unobserve(el)
          } else if (!once) {
            entry.target.classList.remove('is-visible')
          }
        }
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )

    targets.forEach((t) => observer.observe(t))
  })

  onBeforeUnmount(() => observer?.disconnect())
}
