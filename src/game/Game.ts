import { SceneRenderer } from '../render/SceneRenderer';
import { VoxelWorld } from '../world/VoxelWorld';
import { TerrainGenerator } from '../world/TerrainGenerator';
import { PlayerController } from '../player/PlayerController';
import { InteractionSystem } from './InteractionSystem';
import { SaveStore } from './SaveStore';
import { Hud } from '../ui/Hud';
import { HOTBAR_BLOCKS } from '../world/BlockTypes';

export class Game {
  private readonly renderer: SceneRenderer;
  private readonly world: VoxelWorld;
  private readonly player: PlayerController;
  private readonly interaction: InteractionSystem;
  private readonly hud: Hud;
  private readonly saveStore = new SaveStore();
  private readonly seed: number;
  private started = false;
  private lastFrame = performance.now();
  private elapsed = 0;
  private timeOfDay = 0.282;
  private fpsTimer = 0;
  private fpsFrames = 0;
  private lastSave = 0;
  private quality: 'cinematic' | 'balanced' = 'cinematic';

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new SceneRenderer(canvas);
    const save = this.saveStore.load();
    this.seed = save.seed;
    this.world = new VoxelWorld(this.renderer.scene, new TerrainGenerator(this.seed), this.renderer.materials, 3);
    this.world.initialize(save.edits);
    this.player = new PlayerController(this.renderer.camera, this.world);
    this.player.teleportToSafeSpawn();
    this.hud = new Hud();
    this.interaction = new InteractionSystem(this.renderer.scene, this.player, this.world, this.hud);
    this.hud.setSelectedSlot(save.selectedSlot);
    this.bindUi(canvas);
    this.bindShortcuts();
    (window as Window & { __emberwild?: Game }).__emberwild = this;
    this.loop();
  }

  private bindUi(canvas: HTMLCanvasElement): void {
    this.hud.getStartButton().addEventListener('click', () => this.play(canvas));
    this.hud.getResumeButton().addEventListener('click', () => this.play(canvas));
    this.hud.getResetButton().addEventListener('click', () => {
      if (window.confirm('Reset this world and discard your local edits?')) {
        this.saveStore.reset();
        window.location.reload();
      }
    });
    canvas.addEventListener('click', () => {
      if (this.started && !this.player.pointerLocked) this.play(canvas);
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (!this.started) return;
      if (this.player.pointerLocked) this.hud.showPlaying();
      else this.hud.showPaused();
    });
  }

  private bindShortcuts(): void {
    window.addEventListener('keydown', (event) => {
      const number = Number(event.key);
      if (number >= 1 && number <= HOTBAR_BLOCKS.length) this.hud.setSelectedSlot(number - 1);
      if (event.code === 'KeyQ') {
        this.quality = this.quality === 'cinematic' ? 'balanced' : 'cinematic';
        this.renderer.setQuality(this.quality);
      }
    });
  }

  private play(canvas: HTMLCanvasElement): void {
    this.started = true;
    this.hud.showPlaying();
    canvas.requestPointerLock?.();
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const delta = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    this.elapsed += delta;
    if (this.started && this.player.pointerLocked) {
      this.timeOfDay = (this.timeOfDay + delta / 420) % 1;
      this.player.update(delta);
      this.world.update(this.player.position);
      this.interaction.update(this.elapsed);
      if (this.elapsed - this.lastSave > 3) {
        this.saveStore.save(this.seed, this.world.getEdits(), this.hud.getSelectedSlot());
        this.lastSave = this.elapsed;
      }
    } else {
      this.world.update(this.player.position);
      this.interaction.update(this.elapsed);
    }

    const environment = this.renderer.updateEnvironment(this.timeOfDay, this.elapsed, this.player.position);
    this.hud.setTime(environment.label);
    this.hud.setPosition(this.player.position.x, this.player.position.y, this.player.position.z);
    this.fpsTimer += delta;
    this.fpsFrames += 1;
    if (this.fpsTimer > 0.5) {
      this.hud.setFps(this.fpsFrames / this.fpsTimer);
      this.fpsTimer = 0;
      this.fpsFrames = 0;
    }
    this.renderer.render();
  };
}
