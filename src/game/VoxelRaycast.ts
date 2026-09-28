import * as THREE from 'three';
import { BlockType, isSolid } from '../world/BlockTypes';
import type { VoxelWorld } from '../world/VoxelWorld';

export type RaycastHit = {
  block: THREE.Vector3;
  previous: THREE.Vector3;
  type: BlockType;
  normal: THREE.Vector3;
  distance: number;
};

export function raycastVoxel(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, world: VoxelWorld): RaycastHit | null {
  const dir = direction.clone().normalize();
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x);
  const stepY = Math.sign(dir.y);
  const stepZ = Math.sign(dir.z);
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dir.x);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dir.y);
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dir.z);
  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;
  let distance = 0;
  const previous = new THREE.Vector3(x, y, z);

  for (let i = 0; i < 160 && distance <= maxDistance; i += 1) {
    const type = world.getBlock(x, y, z);
    if (type !== BlockType.AIR && (isSolid(type) || type === BlockType.WATER)) {
      return { block: new THREE.Vector3(x, y, z), previous: previous.clone(), type, normal: previous.clone().sub(new THREE.Vector3(x, y, z)).normalize(), distance };
    }
    previous.set(x, y, z);
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      distance = tMaxX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      distance = tMaxY;
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      distance = tMaxZ;
      tMaxZ += tDeltaZ;
    }
  }
  return null;
}
