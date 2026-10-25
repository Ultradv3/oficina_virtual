import { onBeforeUnmount, onMounted, ref } from 'vue'

const STORAGE_KEY = 'agent-office-sound'

let context: AudioContext | null = null
let master: GainNode | null = null
let nodes: Array<OscillatorNode> = []
let pendingGesture = false

const enabled = ref(false)

function readPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persistPreference(value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // sessionStorage puede no estar disponible; la preferencia sigue en memoria.
  }
}

function start() {
  if (typeof window === 'undefined' || context) return
  const AudioCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return

  context = new AudioCtor()
  master = context.createGain()
  master.gain.value = 0
  master.connect(context.destination)

  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 520
  filter.Q.value = 0.7
  filter.connect(master)

  const partials = [110, 164.81, 220]
  partials.forEach((frequency, index) => {
    if (!context || !filter) return
    const oscillator = context.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    const gain = context.createGain()
    gain.gain.value = 0.1 / (index + 1)
    oscillator.connect(gain)
    gain.connect(filter)
    oscillator.start()
    nodes.push(oscillator)
  })

  const lfo = context.createOscillator()
  lfo.frequency.value = 0.06
  const lfoGain = context.createGain()
  lfoGain.gain.value = 0.015
  lfo.connect(lfoGain)
  lfoGain.connect(master.gain)
  lfo.start()
  nodes.push(lfo)

  master.gain.linearRampToValueAtTime(0.05, context.currentTime + 0.3)
}

function stop() {
  if (!context || !master) return
  const current = context
  const currentMaster = master
  currentMaster.gain.cancelScheduledValues(current.currentTime)
  currentMaster.gain.setTargetAtTime(0, current.currentTime, 0.1)
  const toStop = nodes
  nodes = []
  window.setTimeout(() => {
    toStop.forEach((node) => {
      try {
        node.stop()
      } catch {
        // ya detenido
      }
    })
    void current.close().catch(() => undefined)
  }, 350)
  master = null
  context = null
}

async function toggle() {
  enabled.value = !enabled.value
  persistPreference(enabled.value)
  if (enabled.value) start()
  else stop()
}

function onGesture() {
  if (!pendingGesture) return
  pendingGesture = false
  start()
}

function onVisibilityChange() {
  if (document.hidden) stop()
}

export function useSoundscape() {
  onMounted(() => {
    enabled.value = readPreference()
    if (enabled.value) {
      // Sin autoplay: se reanuda con el primer gesto tras restaurar la preferencia.
      pendingGesture = true
      window.addEventListener('pointerdown', onGesture, { once: true })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onGesture)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    pendingGesture = false
    stop()
  })

  return { enabled, toggle }
}
