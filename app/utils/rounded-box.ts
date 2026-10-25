import { BoxGeometry, Vector3 } from 'three/webgpu'
import type { BufferAttribute } from 'three/webgpu'

/**
 * Puerto local de `RoundedBoxGeometry` (three/examples/jsm/geometries/
 * RoundedBoxGeometry.js) sobre el namespace `three/webgpu`, para no depender
 * del build WebGL de los addons. Misma firma que el original:
 *
 * ```ts
 * new RoundedBoxGeometry(width, height, depth, segments, radius)
 * ```
 */

type Axis = 'x' | 'y' | 'z'

const _tempNormal = new Vector3()

function clearAxis(vector: Vector3, axis: Axis): void {
  if (axis === 'x') vector.x = 0
  else if (axis === 'y') vector.y = 0
  else vector.z = 0
}

function getUv(
  faceDirVector: Vector3,
  normal: Vector3,
  uvAxis: Axis,
  projectionAxis: Axis,
  radius: number,
  sideLength: number,
): number {
  const totalArcLength = (2 * Math.PI * radius) / 4

  // longitud de los planos entre los arcos de cada eje
  const centerLength = Math.max(sideLength - 2 * radius, 0)
  const halfArc = Math.PI / 4

  // proyecta la normal sobre el plano del eje pedido
  _tempNormal.copy(normal)
  clearAxis(_tempNormal, projectionAxis)
  _tempNormal.normalize()

  // parte del espacio UV asignada a un arco
  const arcUvRatio = (0.5 * totalArcLength) / (totalArcLength + centerLength)

  // distancia a lo largo del arco a la que está el punto
  const arcAngleRatio = 1 - _tempNormal.angleTo(faceDirVector) / halfArc

  if (Math.sign(_tempNormal[uvAxis]) === 1) {
    return arcAngleRatio * arcUvRatio
  }

  // espacio UV asignado al plano entre los arcos
  const lenUv = centerLength / (totalArcLength + centerLength)
  return lenUv + arcUvRatio + arcUvRatio * (1 - arcAngleRatio)
}

export class RoundedBoxGeometry extends BoxGeometry {
  constructor(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
    // segmentos totales: impar para que quede un plano entre las esquinas
    const totalSegments = segments * 2 + 1

    // el radio nunca puede superar la mitad del lado más corto
    const clampedRadius = Math.min(width / 2, height / 2, depth / 2, radius)

    super(1, 1, 1, totalSegments, totalSegments, totalSegments)

    // mismos metadatos que el addon original
    Object.assign(this, {
      type: 'RoundedBoxGeometry',
      parameters: { width, height, depth, segments, radius: clampedRadius },
    })

    // con un único segmento no hay esquinas que redondear
    if (totalSegments === 1) return

    const source = this.toNonIndexed()
    this.index = null

    const positionAttribute = source.getAttribute('position') as BufferAttribute
    const normalAttribute = source.getAttribute('normal') as BufferAttribute
    const uvAttribute = source.getAttribute('uv') as BufferAttribute

    this.setAttribute('position', positionAttribute)
    this.setAttribute('normal', normalAttribute)
    this.setAttribute('uv', uvAttribute)

    const positions = positionAttribute.array as Float32Array
    const normals = normalAttribute.array as Float32Array
    const uvs = uvAttribute.array as Float32Array

    const vertex = new Vector3()
    const normal = new Vector3()

    const box = new Vector3(width, height, depth).divideScalar(2).subScalar(clampedRadius)

    const faceTris = positions.length / 6
    const faceDirVector = new Vector3()
    const halfSegmentSize = 0.5 / totalSegments

    for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
      vertex.fromArray(positions, i)
      normal.copy(vertex)
      normal.x -= Math.sign(normal.x) * halfSegmentSize
      normal.y -= Math.sign(normal.y) * halfSegmentSize
      normal.z -= Math.sign(normal.z) * halfSegmentSize
      normal.normalize()

      positions[i + 0] = box.x * Math.sign(vertex.x) + normal.x * clampedRadius
      positions[i + 1] = box.y * Math.sign(vertex.y) + normal.y * clampedRadius
      positions[i + 2] = box.z * Math.sign(vertex.z) + normal.z * clampedRadius

      normals[i + 0] = normal.x
      normals[i + 1] = normal.y
      normals[i + 2] = normal.z

      const side = Math.floor(i / faceTris)

      switch (side) {
        case 0: // derecha
          // UVs a lo largo de Z y luego Y
          faceDirVector.set(1, 0, 0)
          uvs[j + 0] = getUv(faceDirVector, normal, 'z', 'y', clampedRadius, depth)
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, 'y', 'z', clampedRadius, height)
          break

        case 1: // izquierda
          faceDirVector.set(-1, 0, 0)
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, 'z', 'y', clampedRadius, depth)
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, 'y', 'z', clampedRadius, height)
          break

        case 2: // arriba
          faceDirVector.set(0, 1, 0)
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, 'x', 'z', clampedRadius, width)
          uvs[j + 1] = getUv(faceDirVector, normal, 'z', 'x', clampedRadius, depth)
          break

        case 3: // abajo
          faceDirVector.set(0, -1, 0)
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, 'x', 'z', clampedRadius, width)
          uvs[j + 1] = getUv(faceDirVector, normal, 'z', 'x', clampedRadius, depth)
          break

        case 4: // delante
          faceDirVector.set(0, 0, 1)
          uvs[j + 0] = 1 - getUv(faceDirVector, normal, 'x', 'y', clampedRadius, width)
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, 'y', 'x', clampedRadius, height)
          break

        case 5: // detrás
          faceDirVector.set(0, 0, -1)
          uvs[j + 0] = getUv(faceDirVector, normal, 'x', 'y', clampedRadius, width)
          uvs[j + 1] = 1 - getUv(faceDirVector, normal, 'y', 'x', clampedRadius, height)
          break
      }
    }
  }
}
