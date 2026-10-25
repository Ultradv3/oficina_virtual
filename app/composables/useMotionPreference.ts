import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

/**
 * Preferencia de movimiento reducido del sistema, reactiva y segura en SSR.
 * Las animaciones de escena la consultan para saltar al estado final.
 */
export function useMotionPreference() {
  const reduceMotion = ref(false)
  let media: MediaQueryList | null = null

  const sync = () => {
    reduceMotion.value = media?.matches ?? false
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    sync()
    media.addEventListener('change', sync)
  })

  onBeforeUnmount(() => {
    media?.removeEventListener('change', sync)
    media = null
  })

  return { reduceMotion: readonly(reduceMotion) }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
