<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { useTresContext } from '@tresjs/core/webgpu'
import {
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from 'three/webgpu'

const props = withDefaults(
  defineProps<{
    positions: Array<[number, number, number]>
    color?: string
    radius?: number
    height?: number
    roughness?: number
  }>(),
  {
    color: '#dfe3e8',
    radius: 0.13,
    height: 0.1,
    roughness: 0.3,
  },
)

const { scene } = useTresContext()
const mesh = shallowRef<InstancedMesh>()
let geometry: CylinderGeometry | null = null
let material: MeshStandardNodeMaterial | null = null

onMounted(() => {
  if (!props.positions.length) return
  geometry = new CylinderGeometry(props.radius, props.radius, props.height, 18)
  geometry.translate(0, props.height / 2, 0)
  material = new MeshStandardNodeMaterial({
    color: props.color,
    roughness: props.roughness,
    metalness: 0,
  })
  const instanced = new InstancedMesh(geometry, material, props.positions.length)
  instanced.receiveShadow = true
  instanced.castShadow = false
  const matrix = new Matrix4()
  const quaternion = new Quaternion()
  const scale = new Vector3(1, 1, 1)
  props.positions.forEach((position, index) => {
    matrix.compose(new Vector3(position[0], position[1], position[2]), quaternion, scale)
    instanced.setMatrixAt(index, matrix)
  })
  instanced.instanceMatrix.needsUpdate = true
  scene.value.add(instanced)
  mesh.value = instanced
})

onBeforeUnmount(() => {
  if (mesh.value) {
    scene.value.remove(mesh.value)
    mesh.value.dispose()
  }
  geometry?.dispose()
  material?.dispose()
  mesh.value = undefined
  geometry = null
  material = null
})
</script>

<template>
  <slot />
</template>
