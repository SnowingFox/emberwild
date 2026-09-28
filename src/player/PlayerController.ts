import * as THREE from 'three';
import type { VoxelWorld } from '../world/VoxelWorld';
import { isSolid } from '../world/BlockTypes';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../world/constants';

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const GRAVITY = 27;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.4;

export class PlayerController {
  readonly camera: THREE.PerspectiveCamera;
  readonly position = new THREE.Vector3(0.5, 36, 0.5);
  readonly velocity = new THREE.Vector3();
  readonly rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  readonly keys = new Set<string>();
  grounded = false;
  pointerLocked = false;
  private yaw = 0;
  private pitch = -0.28;
  private readonly rayOrigin = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, private readonly world: VoxelWorld) {
    this.camera = camera;
    this.bindInput();
  }

  update(delta: number): void {
    const clamped = Math.min(delta, 0.05);
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (this.keys.has('KeyW')) wish.add(forward);
    if (this.keys.has('KeyS')) wish.sub(forward);
    if (this.keys.has('KeyD')) wish.add(right);
    if (this.keys.has('KeyA')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED;
    const acceleration = this.grounded ? 28 : 12;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wish.x * speed, acceleration, clamped);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wish.z * speed, acceleration, clamped);
    this.velocity.y -= GRAVITY * clamped;
    if (this.grounded && this.keys.has('Space')) {
      this.velocity.y = 9.4;
      this.grounded = false;
    }

    this.moveAxis('x', this.velocity.x * clamped);
    this.moveAxis('z', this.velocity.z * clamped);
    this.moveAxis('y', this.velocity.y * clamped);

    if (this.position.y < -10) {
      this.position.set(0.5, this.findSpawnHeight() + 0.05, 0.5);
      this.velocity.set(0, 0, 0);
    }
    this.camera.position.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0));
    this.rotation.set(this.pitch, this.yaw, 0);
    this.camera.rotation.copy(this.rotation);
  }

  getEyePosition(target = this.rayOrigin): THREE.Vector3 {
    return target.copy(this.camera.position);
  }

  getLookDirection(target = new THREE.Vector3()): THREE.Vector3 {
    return this.camera.getWorldDirection(target);
  }

  teleportToSafeSpawn(): void {
    this.position.set(0.5, this.findSpawnHeight() + 0.05, 0.5);
    this.velocity.set(0, 0, 0);
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number): void {
    if (amount === 0) return;
    const next = this.position.clone();
    next[axis] += amount;
    if (!this.collides(next)) {
      this.position.copy(next);
      if (axis === 'y') this.grounded = false;
      return;
    }
    if (axis === 'y') {
      if (amount < 0) this.grounded = true;
      this.velocity.y = 0;
    } else this.velocity[axis] = 0;
  }

  private collides(center: THREE.Vector3): boolean {
    const minX = Math.floor(center.x - PLAYER_WIDTH / 2);
    const maxX = Math.floor(center.x + PLAYER_WIDTH / 2 - 0.001);
    const minY = Math.floor(center.y);
    const maxY = Math.floor(center.y + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(center.z - PLAYER_WIDTH / 2);
    const maxZ = Math.floor(center.z + PLAYER_WIDTH / 2 - 0.001);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          if (isSolid(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  private findSpawnHeight(): number {
    for (let y = WORLD_HEIGHT - 2; y > 2; y -= 1) {
      if (!isSolid(this.world.getBlock(0, y, 0)) && isSolid(this.world.getBlock(0, y - 1, 0))) return y;
    }
    return 30;
  }

  private bindInput(): void {
    window.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement instanceof HTMLCanvasElement;
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked) return;
      this.yaw -= event.movementX * 0.0023;
      this.pitch -= event.movementY * 0.0023;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    });
  }
}
