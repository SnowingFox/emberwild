import * as THREE from 'three';
import { BlockType } from './BlockTypes';
import { CHUNK_SIZE, chunkKey, worldToChunk, WORLD_HEIGHT } from './constants';
import { Chunk } from './Chunk';
import { TerrainGenerator } from './TerrainGenerator';
import { buildChunkGeometries } from './VoxelMesher';
import { MaterialBundle } from '../render/Materials';

export type WorldEdit = { x: number; y: number; z: number; type: BlockType };

type ChunkRecord = {
  chunk: Chunk;
  group: THREE.Group;
};

export class VoxelWorld {
  readonly scene: THREE.Scene;
  readonly generator: TerrainGenerator;
  readonly materials: MaterialBundle;
  readonly chunks = new Map<string, ChunkRecord>();
  readonly edits = new Map<string, BlockType>();
  private readonly renderRadius: number;
  private readonly playerCenter = new THREE.Vector3();
  private readonly pending = new Set<string>();
  private generationQueue: { cx: number; cz: number; distance: number }[] = [];
  private generationStarted = false;

  constructor(scene: THREE.Scene, generator: TerrainGenerator, materials: MaterialBundle, renderRadius = 3) {
    this.scene = scene;
    this.generator = generator;
    this.materials = materials;
    this.renderRadius = renderRadius;
  }

  initialize(savedEdits: WorldEdit[] = []): void {
    for (const edit of savedEdits) this.edits.set(this.editKey(edit.x, edit.y, edit.z), edit.type);
    this.ensureAround(0, 0);
  }

  update(playerPosition: THREE.Vector3): void {
    this.playerCenter.copy(playerPosition);
    const { chunk: cx } = worldToChunk(Math.floor(playerPosition.x));
    const { chunk: cz } = worldToChunk(Math.floor(playerPosition.z));
    this.ensureAround(cx, cz);
    this.processGenerationQueue(2);
    this.rebuildDirtyChunks(2);
    this.unloadFarChunks(cx, cz);
  }

  getBlock(worldX: number, y: number, worldZ: number): BlockType {
    if (y < 0 || y >= WORLD_HEIGHT) return BlockType.AIR;
    const { chunk: cx, local: lx } = worldToChunk(Math.floor(worldX));
    const { chunk: cz, local: lz } = worldToChunk(Math.floor(worldZ));
    const record = this.chunks.get(chunkKey(cx, cz));
    if (!record) {
      return y <= this.generator.heightAt(Math.floor(worldX), Math.floor(worldZ)) ? BlockType.STONE : BlockType.AIR;
    }
    return record.chunk.get(lx, y, lz);
  }

  setBlock(worldX: number, y: number, worldZ: number, type: BlockType, persist = true): void {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    const { chunk: cx, local: lx } = worldToChunk(x);
    const { chunk: cz, local: lz } = worldToChunk(z);
    const record = this.chunks.get(chunkKey(cx, cz));
    if (!record) return;
    record.chunk.set(lx, y, lz, type);
    if (persist) this.edits.set(this.editKey(x, y, z), type);
    this.markNeighborDirty(cx, cz, lx, lz);
  }

  getLoadedChunkCount(): number {
    return this.chunks.size;
  }

  getEdits(): WorldEdit[] {
    return Array.from(this.edits.entries()).map(([key, type]) => {
      const [x, y, z] = key.split(',').map(Number);
      return { x, y, z, type };
    });
  }

  private ensureAround(centerX: number, centerZ: number): void {
    const desired = [];
    for (let dz = -this.renderRadius; dz <= this.renderRadius; dz += 1) {
      for (let dx = -this.renderRadius; dx <= this.renderRadius; dx += 1) {
        const distance = Math.hypot(dx, dz);
        if (distance > this.renderRadius + 0.25) continue;
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = chunkKey(cx, cz);
        const alreadyQueued = this.generationQueue.some((entry) => entry.cx === cx && entry.cz === cz);
        if (!this.chunks.has(key) && !this.pending.has(key) && !alreadyQueued) {
          this.pending.add(key);
          desired.push({ cx, cz, distance });
        }
      }
    }
    this.generationQueue.push(...desired);
    this.generationQueue.sort((a, b) => a.distance - b.distance);
  }

  private processGenerationQueue(limit: number): void {
    for (let i = 0; i < limit && this.generationQueue.length > 0; i += 1) {
      const next = this.generationQueue.shift();
      if (!next) continue;
      const key = chunkKey(next.cx, next.cz);
      if (this.chunks.has(key)) continue;
      const chunk = new Chunk(next.cx, next.cz);
      this.generator.generate(chunk);
      this.applyEdits(chunk);
      const group = new THREE.Group();
      group.position.set(next.cx * CHUNK_SIZE, 0, next.cz * CHUNK_SIZE);
      group.name = `chunk-${key}`;
      this.scene.add(group);
      this.chunks.set(key, { chunk, group });
      this.pending.delete(key);
      this.markNeighborDirty(next.cx, next.cz, 0, 0, true);
    }
  }

  private rebuildDirtyChunks(limit: number): void {
    let built = 0;
    for (const record of this.chunks.values()) {
      if (!record.chunk.dirty || built >= limit) continue;
      this.rebuildChunk(record);
      built += 1;
    }
  }

  private rebuildChunk(record: ChunkRecord): void {
    const { chunk, group } = record;
    if (chunk.meshes.solid) {
      group.remove(chunk.meshes.solid);
      chunk.meshes.solid.geometry.dispose();
    }
    if (chunk.meshes.water) {
      group.remove(chunk.meshes.water);
      chunk.meshes.water.geometry.dispose();
    }

    const geometries = buildChunkGeometries(chunk, this);
    if (geometries.solid) {
      const mesh = new THREE.Mesh(geometries.solid, this.materials.terrain);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(0, 0, 0);
      group.add(mesh);
      chunk.meshes.solid = mesh;
    } else chunk.meshes.solid = null;

    if (geometries.water) {
      const mesh = new THREE.Mesh(geometries.water, this.materials.water);
      mesh.receiveShadow = true;
      group.add(mesh);
      chunk.meshes.water = mesh;
    } else chunk.meshes.water = null;
    chunk.dirty = false;
  }

  private unloadFarChunks(centerX: number, centerZ: number): void {
    for (const [key, record] of this.chunks) {
      const distance = Math.max(Math.abs(record.chunk.cx - centerX), Math.abs(record.chunk.cz - centerZ));
      if (distance <= this.renderRadius + 1) continue;
      this.scene.remove(record.group);
      record.chunk.meshes.solid?.geometry.dispose();
      record.chunk.meshes.water?.geometry.dispose();
      this.chunks.delete(key);
    }
  }

  private markNeighborDirty(cx: number, cz: number, lx: number, lz: number, force = false): void {
    const targets: [number, number][] = [[cx, cz]];
    if (force || lx === 0) targets.push([cx - 1, cz]);
    if (force || lx === CHUNK_SIZE - 1) targets.push([cx + 1, cz]);
    if (force || lz === 0) targets.push([cx, cz - 1]);
    if (force || lz === CHUNK_SIZE - 1) targets.push([cx, cz + 1]);
    for (const [tx, tz] of targets) {
      const record = this.chunks.get(chunkKey(tx, tz));
      if (record) record.chunk.dirty = true;
    }
  }

  private applyEdits(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      for (let y = 0; y < WORLD_HEIGHT; y += 1) {
        for (let z = 0; z < CHUNK_SIZE; z += 1) {
          const edit = this.edits.get(this.editKey(baseX + x, y, baseZ + z));
          if (edit !== undefined) chunk.set(x, y, z, edit);
        }
      }
    }
  }

  private editKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
}
