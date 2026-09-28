import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from './constants';
import { BLOCKS, BlockType, getBlockDefinition, isOpaque } from './BlockTypes';
import { Chunk } from './Chunk';
import type { VoxelWorld } from './VoxelWorld';
import { tileUv } from '../render/Materials';

export type ChunkGeometries = {
  solid: THREE.BufferGeometry | null;
  water: THREE.BufferGeometry | null;
};

type Face = {
  normal: [number, number, number];
  corners: [number, number, number][];
};

const FACES: Face[] = [
  { normal: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
];

const UVS: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
const FACE_SHADE = [1.0, 0.62, 0.78, 0.86, 0.72, 0.92];

function emptyGeometry(): THREE.BufferGeometry | null {
  return null;
}

function makeGeometry(data: {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  winds: number[];
  indices: number[];
}): THREE.BufferGeometry | null {
  if (data.positions.length === 0) return emptyGeometry();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setAttribute('aWind', new THREE.Float32BufferAttribute(data.winds, 1));
  geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function pushQuad(
  data: { positions: number[]; normals: number[]; uvs: number[]; colors: number[]; winds: number[]; indices: number[] },
  face: Face,
  x: number,
  y: number,
  z: number,
  tile: number,
  shade: number,
  wind: number,
): void {
  const offset = data.positions.length / 3;
  face.corners.forEach((corner, index) => {
    const [px, py, pz] = corner;
    data.positions.push(x + px, y + py, z + pz);
    data.normals.push(...face.normal);
    const mapped = tileUv(tile, UVS[index][0], UVS[index][1]);
    data.uvs.push(mapped.u, mapped.v);
    const cornerShade = shade * (index === 0 || index === 2 ? 0.97 : 1.0);
    data.colors.push(cornerShade, cornerShade * (0.98 + py * 0.02), cornerShade * 0.94);
    data.winds.push(wind);
  });
  data.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
}

export function buildChunkGeometries(chunk: Chunk, world: VoxelWorld): ChunkGeometries {
  const solid = { positions: [], normals: [], uvs: [], colors: [], winds: [], indices: [] };
  const water = { positions: [], normals: [], uvs: [], colors: [], winds: [], indices: [] };

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const type = chunk.get(x, y, z);
        if (type === BlockType.AIR) continue;
        const definition = getBlockDefinition(type);
        const target = type === BlockType.WATER ? water : solid;

        for (let faceIndex = 0; faceIndex < FACES.length; faceIndex += 1) {
          const face = FACES[faceIndex];
          const nx = chunk.cx * CHUNK_SIZE + x + face.normal[0];
          const ny = y + face.normal[1];
          const nz = chunk.cz * CHUNK_SIZE + z + face.normal[2];
          const neighbor = world.getBlock(nx, ny, nz);

          if (type === BlockType.WATER) {
            if (neighbor === BlockType.WATER) continue;
            if (face.normal[1] < 0 && neighbor !== BlockType.AIR) continue;
            if (face.normal[1] === 0 && neighbor !== BlockType.AIR) continue;
            pushQuad(target, face, x, y, z, 0, faceIndex === 0 ? 1 : 0.8, 0);
            continue;
          }

          if (isOpaque(neighbor)) continue;
          const tile = face.normal[1] > 0 ? definition.topTile : face.normal[1] < 0 ? definition.bottomTile : definition.sideTile;
          const shade = FACE_SHADE[faceIndex] * (definition.emissive ? 1.3 : 1);
          pushQuad(target, face, x, y, z, tile, shade, type === BlockType.LEAVES ? 1 : 0);
        }
      }
    }
  }

  return {
    solid: makeGeometry(solid),
    water: makeGeometry(water),
  };
}
