<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useTresContext } from '@tresjs/core/webgpu'
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  OrthographicCamera,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  Vector3,
} from 'three/webgpu'
import type { OfficeAgent } from '~/types/office'
import { setAgentPortrait, useAgentPortraits } from '~/composables/useAgentPortraits'

const props = defineProps<{ agents: OfficeAgent[] }>()

const context = useTresContext()
const { portraits } = useAgentPortraits()
const initialized = context.renderer.isInitialized
const SIZE = 128
let baking = false
let retryTimer: ReturnType<typeof setTimeout> | null = null

function findMinifig(agentId: string): unknown {
  let found: unknown = null
  context.scene.value.traverse((object) => {
    const data = (object as { userData?: Record<string, unknown> }).userData
    if (!found && data?.agentMinifig === true && data?.agentId === agentId) found = object
  })
  return found
}

async function bake(agent: OfficeAgent) {
  const source = findMinifig(agent.id) as
    | { clone: (recursive: boolean) => unknown; removeFromParent?: () => void }
    | null
  if (!source) return

  const identityKey = `${agent.name}|v${agent.externalId}|front`
  if (portraits.value[agent.id]?.identityKey === identityKey) return

  const clone = source.clone(true) as {
    position: { set: (x: number, y: number, z: number) => void }
    rotation: { set: (x: number, y: number, z: number) => void }
    updateMatrixWorld: (force?: boolean) => void
  }
  clone.position.set(0, 0, 0)
  // El retrato es independiente del giro del escritorio: el minifig mira a la
  // cámara del retrato y se centra por su caja envolvente, no por el origen.
  clone.rotation.set(0, 0, 0)
  clone.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(clone as never)
  const center = bounds.getCenter(new Vector3())
  clone.position.set(-center.x, -center.y, -center.z)
  clone.updateMatrixWorld(true)

  const scene = new Scene()
  scene.add(clone as never)
  scene.add(new AmbientLight('#ffffff', 1.15))
  const key = new DirectionalLight('#fff1d8', 2.6)
  key.position.set(2.6, 4, 3.4)
  scene.add(key)
  const rim = new DirectionalLight('#9cc4ff', 1.3)
  rim.position.set(-2.4, 2.2, -3.2)
  scene.add(rim)

  const camera = new OrthographicCamera(-1.05, 1.05, 1.05, -1.05, 0.1, 20)
  camera.position.set(2.2, 3.1, 4.2)
  camera.lookAt(0, 0, 0)

  const target = new RenderTarget(SIZE, SIZE, { depthBuffer: true })
  target.texture.colorSpace = SRGBColorSpace

  const renderer = context.renderer.instance as unknown as {
    setRenderTarget: (target: RenderTarget | null) => void
    render: (scene: Scene, camera: OrthographicCamera) => void
    readRenderTargetPixelsAsync: (
      target: RenderTarget,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => Promise<Uint8Array>
  }

  try {
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    const raw = await renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE)

    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(SIZE, SIZE)
    for (let y = 0; y < SIZE; y += 1) {
      const sourceRow = (SIZE - 1 - y) * SIZE * 4
      const destinationRow = y * SIZE * 4
      image.data.set(raw.subarray(sourceRow, sourceRow + SIZE * 4), destinationRow)
    }
    ctx.putImageData(image, 0, 0)

    setAgentPortrait(agent.id, {
      url: canvas.toDataURL('image/png'),
      alt: `Minifigura de ${agent.name}`,
      identityKey,
    })
  } catch {
    // El respaldo SVG de AgentAvatar cubre cualquier fallo de lectura del target.
  } finally {
    renderer.setRenderTarget(null)
    target.dispose()
    scene.clear()
  }
}

async function bakeAll() {
  if (baking) return
  baking = true
  try {
    for (const agent of props.agents) {
      await bake(agent)
    }
    // Los escritorios pueden montarse después del canvas: si aún no hay minifig
    // etiquetada, se reintenta una vez tras el siguiente frame.
    const missing = props.agents.some((agent) => !findMinifig(agent.id))
    if (missing && !retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null
        void bakeAll()
      }, 600)
    }
  } finally {
    baking = false
  }
}

watch(
  [
    () => props.agents.map((agent) => `${agent.id}:${agent.name}:${agent.externalId}`).join('|'),
    () => initialized.value,
  ],
  ([, ready]) => {
    if (!ready) return
    void bakeAll()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = null
})
</script>

<template>
  <slot />
</template>
