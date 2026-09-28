import { BlockType } from './BlockTypes';
import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from './constants';
import { Chunk } from './Chunk';
import { fbm2D, hash2D } from '../utils/noise';

export class TerrainGenerator {
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  heightAt(worldX: number, worldZ: number): number {
    const continental = fbm2D(worldX * 0.012, worldZ * 0.012, this.seed, 5);
    const detail = fbm2D(worldX * 0.045, worldZ * 0.045, this.seed + 37, 3);
    const ridge = Math.abs(fbm2D(worldX * 0.021, worldZ * 0.021, this.seed + 91, 3) * 2 - 1);
    const rolling = 25 + continental * 17 + detail * 5 + ridge * 4;
    const spawnEase = Math.max(0, 1 - Math.hypot(worldX, worldZ) / 14);
    return Math.max(4, Math.min(WORLD_HEIGHT - 8, Math.floor(rolling * (1 - spawnEase * 0.2) + 29 * spawnEase * 0.2)));
  }

  moistureAt(worldX: number, worldZ: number): number {
    return fbm2D(worldX * 0.018 + 11, worldZ * 0.018 - 7, this.seed + 401, 4);
  }

  generate(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx += 1) {
      for (let lz = 0; lz < CHUNK_SIZE; lz += 1) {
        const worldX = baseX + lx;
        const worldZ = baseZ + lz;
        const columnHeight = this.heightAt(worldX, worldZ);
        const moisture = this.moistureAt(worldX, worldZ);
        const beach = columnHeight <= SEA_LEVEL + 1;
        const topType = beach || moisture < 0.3 ? BlockType.SAND : BlockType.GRASS;

        for (let y = 0; y <= columnHeight; y += 1) {
          let type: BlockType;
          if (y === 0) type = BlockType.STONE;
          else if (y === columnHeight) type = topType;
          else if (y >= columnHeight - 3) type = topType === BlockType.SAND ? BlockType.SAND : BlockType.DIRT;
          else type = BlockType.STONE;
          chunk.set(lx, y, lz, type);
        }

        for (let y = columnHeight + 1; y <= SEA_LEVEL; y += 1) {
          chunk.set(lx, y, lz, BlockType.WATER);
        }
      }
    }

    for (let lx = 2; lx < CHUNK_SIZE - 2; lx += 1) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz += 1) {
        const worldX = baseX + lx;
        const worldZ = baseZ + lz;
        const top = this.heightAt(worldX, worldZ);
        const chance = hash2D(worldX * 3 + 17, worldZ * 3 - 19, this.seed + 808);
        const nearSpawn = Math.hypot(worldX, worldZ) < 11;
        if (top > SEA_LEVEL + 2 && top < WORLD_HEIGHT - 10 && chance > 0.845 && !nearSpawn && this.moistureAt(worldX, worldZ) > 0.38) {
          this.placeTree(chunk, lx, top + 1, lz, hash2D(worldX, worldZ, this.seed + 901));
        }
      }
    }

    const emberChance = hash2D(chunk.cx * 17, chunk.cz * 31, this.seed + 1201);
    if (emberChance > 0.62) {
      const lx = 3 + Math.floor(hash2D(chunk.cx, chunk.cz + 4, this.seed + 31) * 10);
      const lz = 3 + Math.floor(hash2D(chunk.cx + 7, chunk.cz, this.seed + 51) * 10);
      const y = this.heightAt(baseX + lx, baseZ + lz) + 1;
      if (y < WORLD_HEIGHT - 1 && chunk.get(lx, y, lz) === BlockType.AIR) chunk.set(lx, y, lz, BlockType.GLOW);
    }

    chunk.dirty = true;
  }

  private placeTree(chunk: Chunk, x: number, y: number, z: number, variant: number): void {
    const trunkHeight = 4 + Math.floor(variant * 3);
    for (let i = 0; i < trunkHeight; i += 1) {
      if (y + i < WORLD_HEIGHT) chunk.set(x, y + i, z, BlockType.WOOD);
    }

    const canopyBase = y + trunkHeight - 2;
    for (let ox = -2; ox <= 2; ox += 1) {
      for (let oz = -2; oz <= 2; oz += 1) {
        for (let oy = 0; oy <= 2; oy += 1) {
          const distance = Math.abs(ox) + Math.abs(oz) + (oy === 2 ? 1 : 0);
          if (distance > 4 || (distance === 4 && variant < 0.45)) continue;
          const px = x + ox;
          const py = canopyBase + oy;
          const pz = z + oz;
          if (px >= 0 && px < CHUNK_SIZE && py >= 0 && py < WORLD_HEIGHT && pz >= 0 && pz < CHUNK_SIZE && chunk.get(px, py, pz) === BlockType.AIR) {
            chunk.set(px, py, pz, BlockType.LEAVES);
          }
        }
      }
    }
  }
}
