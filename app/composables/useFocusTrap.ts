import { onBeforeUnmount } from 'vue'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface FocusTrapOptions {
  onEscape?: () => void
}

/**
 * Atrapa el foco dentro de un contenedor mientras está activo, cicla con Tab y
 * Shift+Tab, cierra con Escape y devuelve el foco al disparador al desactivarse.
 */
export function useFocusTrap(options: FocusTrapOptions = {}) {
  let previous: HTMLElement | null = null
  let container: HTMLElement | null = null

  function isClient(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
  }

  function focusables(): HTMLElement[] {
    if (!container || !isClient()) return []
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    )
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      options.onEscape?.()
      return
    }
    if (event.key !== 'Tab') return

    const items = focusables()
    if (items.length === 0) {
      event.preventDefault()
      return
    }

    const first = items[0]!
    const last = items[items.length - 1]!
    const active = document.activeElement as HTMLElement | null
    const inside = active ? container?.contains(active) : false

    if (event.shiftKey && (!inside || active === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault()
      first.focus()
    }
  }

  function activate(element: HTMLElement | null | undefined, initial?: HTMLElement | null) {
    deactivate()
    if (!isClient() || !element) return
    container = element
    previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.addEventListener('keydown', onKeydown, true)
    const target = initial ?? focusables()[0] ?? element
    requestAnimationFrame(() => target.focus())
  }

  function deactivate() {
    if (isClient()) {
      document.removeEventListener('keydown', onKeydown, true)
      if (previous && document.contains(previous)) previous.focus()
    }
    container = null
    previous = null
  }

  onBeforeUnmount(deactivate)

  return { activate, deactivate }
}
