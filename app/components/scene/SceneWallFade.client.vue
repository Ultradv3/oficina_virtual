<script setup lang="ts">
import { MathUtils, type Material, type Mesh } from 'three/webgpu'
import { useLoop, useTresContext } from '@tresjs/core/webgpu'
import { WALL_LAYOUT } from '~/utils/wall-layout'

/**
 * Paredes adaptativas: cuando la cámara orbita por detrás de la pared trasera
 * o de la pared izquierda, esa pared se vuelve transparente para dejar ver el
 * interior. Al volver a la vista frontal recupera su opacidad.
 *
 * Vive dentro de `<TresCanvas>`; los grupos de pared llevan
 * `userData.wallFade = 'back' | 'left'`.
 */
interface FadeMaterial {
  material: Material
  baseOpacity: number
  baseTransparent: boolean
  baseDepthWrite: boolean
}

interface WallEntry {
  materials: FadeMaterial[]
  current: number
}

const { scene, camera } = useTresContext()
const { onRender } = useLoop()
const walls = new Map<'back' | 'left', WallEntry>()
let collected = false
let lastBackTransparent: boolean | null = null
let lastLeftTransparent: boolean | null = null

/** Los materiales de pared se clonan para no alterar los compartidos de la escena. */
function cloneWallMaterials(root: Mesh): FadeMaterial[] {
  const entries: FadeMaterial[] = []
  const source = root.material
  const materials = Array.isArray(source) ? source : [source]
  const clones = materials.map((material) => {
    const clone = material.clone()
    entries.push({
      material: clone,
      baseOpacity: clone.opacity,
      baseTransparent: clone.transparent,
      baseDepthWrite: clone.depthWrite,
    })
    return clone
  })
  root.material = Array.isArray(source) ? clones : clones[0]!
  return entries
}

function collectWalls() {
  if (collected || !scene.value) return
  const found = new Map<'back' | 'left', FadeMaterial[]>()
  scene.value.traverse((object) => {
    const wall = object.userData?.wallFade as 'back' | 'left' | undefined
    if (wall !== 'back' && wall !== 'left') return
    const entries: FadeMaterial[] = []
    object.traverse((child) => {
      const mesh = child as Mesh
      if (mesh.isMesh) entries.push(...cloneWallMaterials(mesh))
    })
    found.set(wall, [...(found.get(wall) ?? []), ...entries])
  })
  if (found.size === 0) return
  for (const [wall, materials] of found) {
    walls.set(wall, { materials, current: 1 })
  }
  collected = true
}

function fade(wall: 'back' | 'left', target: number, delta: number) {
  const entry = walls.get(wall)
  if (!entry) return
  const speed = 1 - Math.exp(-Math.min(delta || 0.016, 0.05) * 6)
  entry.current = MathUtils.lerp(entry.current, target, speed)
  const transparent = entry.current < 0.995
  const changed = transparent !== (wall === 'back' ? lastBackTransparent : lastLeftTransparent)
  if (wall === 'back') lastBackTransparent = transparent
  else lastLeftTransparent = transparent

  for (const part of entry.materials) {
    part.material.opacity = part.baseOpacity * entry.current
    part.material.transparent = transparent || part.baseTransparent
    part.material.depthWrite = transparent ? false : part.baseDepthWrite
    if (changed) part.material.needsUpdate = true
  }
}

onRender(({ delta }) => {
  collectWalls()
  if (walls.size === 0) return
  const cam = camera.activeCamera.value
  if (!cam) return
  const backTarget = cam.position.z < WALL_LAYOUT.back.inner ? 0.16 : 1
  const leftTarget = cam.position.x < WALL_LAYOUT.left.inner ? 0.16 : 1
  fade('back', backTarget, delta ?? 0.016)
  fade('left', leftTarget, delta ?? 0.016)
})
</script>

<template>
  <slot />
</template>
