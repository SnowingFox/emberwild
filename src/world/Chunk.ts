import type { Mesh } from 'three';
import { localIndex, CHUNK_SIZE, WORLD_HEIGHT } from './constants';
import { BlockType } from './BlockTypes';

export type ChunkMeshes = {
  solid: Mesh | null;
  water: Mesh | null;
};

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  dirty = true;
  meshes: ChunkMeshes = { solid: null, water: null };

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    this.blocks.fill(BlockType.AIR);
  }

  get(x: number, y: number, z: number): BlockType {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return BlockType.AIR;
    }
    return this.blocks[localIndex(x, y, z)] as BlockType;
  }

  set(x: number, y: number, z: number, type: BlockType): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.blocks[localIndex(x, y, z)] = type;
    this.dirty = true;
  }
}
