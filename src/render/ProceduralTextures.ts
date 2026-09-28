import * as THREE from 'three';

export const ATLAS_TILE_COUNT = 8;
export const ATLAS_TILE_SIZE = 64;

function hash(value: number): number {
  let x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawNoisyTile(ctx: CanvasRenderingContext2D, tile: number, base: string, accent: string, seed: number): void {
  const x = tile * ATLAS_TILE_SIZE;
  ctx.fillStyle = base;
  ctx.fillRect(x, 0, ATLAS_TILE_SIZE, ATLAS_TILE_SIZE);
  for (let py = 0; py < ATLAS_TILE_SIZE; py += 4) {
    for (let px = 0; px < ATLAS_TILE_SIZE; px += 4) {
      const n = hash(seed + tile * 71 + px * 0.83 + py * 1.17);
      if (n > 0.48) {
        ctx.fillStyle = n > 0.83 ? accent : `${accent}99`;
        ctx.fillRect(x + px, py, 4, 4);
      }
    }
  }
}

export function createBlockAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_TILE_SIZE * ATLAS_TILE_COUNT;
  canvas.height = ATLAS_TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  ctx.imageSmoothingEnabled = false;

  drawNoisyTile(ctx, 0, '#6f7677', '#9da29d', 3.1);
  drawNoisyTile(ctx, 1, '#5e8d4a', '#a9c865', 8.2);
  drawNoisyTile(ctx, 2, '#86b857', '#c2df81', 13.7);
  drawNoisyTile(ctx, 3, '#805c3f', '#ad7950', 19.4);
  drawNoisyTile(ctx, 4, '#cfaa67', '#f0d08b', 27.8);
  drawNoisyTile(ctx, 5, '#866342', '#c5965b', 34.5);
  drawNoisyTile(ctx, 6, '#36744e', '#72aa63', 41.6);
  drawNoisyTile(ctx, 7, '#cb7542', '#ffd892', 48.9);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
