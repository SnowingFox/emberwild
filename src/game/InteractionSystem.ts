import * as THREE from 'three';
import { BlockType, isSolid } from '../world/BlockTypes';
import type { VoxelWorld } from '../world/VoxelWorld';
import { raycastVoxel, RaycastHit } from './VoxelRaycast';
import { PlayerController } from '../player/PlayerController';
import { Hud } from '../ui/Hud';

export class InteractionSystem {
  private readonly outline: THREE.LineSegments;
  private target: RaycastHit | null = null;
  private lastAction = 0;

  constructor(private readonly scene: THREE.Scene, private readonly player: PlayerController, private readonly world: VoxelWorld, private readonly hud: Hud) {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01));
    const material = new THREE.LineBasicMaterial({ color: '#ffe0ac', transparent: true, opacity: 0.92, depthTest: false });
    this.outline = new THREE.LineSegments(geometry, material);
    this.outline.visible = false;
    this.outline.renderOrder = 8;
    this.scene.add(this.outline);
    window.addEventListener('mousedown', (event) => this.onMouseDown(event));
  }

  update(time: number): void {
    this.target = raycastVoxel(this.player.getEyePosition(), this.player.getLookDirection(), 7.5, this.world);
    if (!this.target) {
      this.outline.visible = false;
      this.hud.setTarget(null);
      return;
    }
    this.outline.visible = true;
    this.outline.position.copy(this.target.block).addScalar(0.5);
    this.hud.setTarget(this.target.type);
    if (time - this.lastAction > 0.25) (this.outline.material as THREE.LineBasicMaterial).opacity = 0.92;
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.player.pointerLocked || !this.target) return;
    const now = performance.now() / 1000;
    if (now - this.lastAction < 0.18) return;
    this.lastAction = now;
    if (event.button === 0) {
      if (this.target.type === BlockType.WATER) return;
      this.world.setBlock(this.target.block.x, this.target.block.y, this.target.block.z, BlockType.AIR);
    } else if (event.button === 2) {
      const place = this.target.previous;
      const type = this.hud.getSelectedBlock();
      if (type === BlockType.WATER || !this.canPlace(place, type)) return;
      this.world.setBlock(place.x, place.y, place.z, type);
    }
  }

  private canPlace(position: THREE.Vector3, type: BlockType): boolean {
    if (!isSolid(type)) return false;
    const playerCenter = this.player.position;
    const blockMin = position;
    const blockMax = position.clone().addScalar(1);
    const playerMin = new THREE.Vector3(playerCenter.x - 0.3, playerCenter.y, playerCenter.z - 0.3);
    const playerMax = new THREE.Vector3(playerCenter.x + 0.3, playerCenter.y + 1.8, playerCenter.z + 0.3);
    const overlaps = blockMin.x < playerMax.x && blockMax.x > playerMin.x && blockMin.y < playerMax.y && blockMax.y > playerMin.y && blockMin.z < playerMax.z && blockMax.z > playerMin.z;
    return !overlaps && this.world.getBlock(position.x, position.y, position.z) === BlockType.AIR;
  }
}
