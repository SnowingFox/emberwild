import { BLOCKS, BlockType, HOTBAR_BLOCKS } from '../world/BlockTypes';

export class Hud {
  private readonly hud: HTMLElement;
  private readonly startScreen: HTMLElement;
  private readonly pauseScreen: HTMLElement;
  private readonly hotbar: HTMLElement;
  private readonly targetReadout: HTMLElement;
  private readonly positionReadout: HTMLElement;
  private readonly timeReadout: HTMLElement;
  private readonly fpsReadout: HTMLElement;
  private selectedSlot = 0;

  constructor() {
    this.hud = this.byId('hud');
    this.startScreen = this.byId('start-screen');
    this.pauseScreen = this.byId('pause-screen');
    this.hotbar = this.byId('hotbar');
    this.targetReadout = this.byId('target-readout');
    this.positionReadout = this.byId('position-readout');
    this.timeReadout = this.byId('time-readout');
    this.fpsReadout = this.byId('fps-readout');
    this.renderHotbar();
  }

  getStartButton(): HTMLButtonElement { return this.byId('start-button') as HTMLButtonElement; }
  getResumeButton(): HTMLButtonElement { return this.byId('resume-button') as HTMLButtonElement; }
  getResetButton(): HTMLButtonElement { return this.byId('reset-button') as HTMLButtonElement; }

  showPlaying(): void {
    this.startScreen.classList.remove('visible');
    this.pauseScreen.classList.remove('visible');
    this.hud.hidden = false;
  }

  showStart(): void {
    this.startScreen.classList.add('visible');
    this.pauseScreen.classList.remove('visible');
    this.hud.hidden = true;
  }

  showPaused(): void {
    this.pauseScreen.classList.add('visible');
    this.hud.hidden = false;
  }

  setSelectedSlot(slot: number): void {
    this.selectedSlot = Math.max(0, Math.min(HOTBAR_BLOCKS.length - 1, slot));
    this.renderHotbar();
  }

  getSelectedBlock(): BlockType { return HOTBAR_BLOCKS[this.selectedSlot]; }
  getSelectedSlot(): number { return this.selectedSlot; }

  setTarget(block: BlockType | null): void {
    this.targetReadout.textContent = block ? `${BLOCKS[block].name}  ·  ${this.selectedSlot + 1} SELECTED` : 'LOOK AROUND TO EXPLORE';
  }

  setPosition(x: number, y: number, z: number): void {
    this.positionReadout.textContent = `X ${Math.floor(x)}  Y ${Math.floor(y)}  Z ${Math.floor(z)}`;
  }

  setTime(label: string): void { this.timeReadout.textContent = label; }
  setFps(fps: number): void { this.fpsReadout.textContent = `${Math.round(fps)} FPS`; }

  private renderHotbar(): void {
    this.hotbar.replaceChildren();
    HOTBAR_BLOCKS.forEach((type, index) => {
      const slot = document.createElement('div');
      slot.className = `hotbar-slot${index === this.selectedSlot ? ' selected' : ''}`;
      slot.style.setProperty('--swatch', this.swatchFor(type));
      slot.innerHTML = `<span class="slot-number">${index + 1}</span>`;
      slot.title = BLOCKS[type].name;
      this.hotbar.append(slot);
    });
  }

  private swatchFor(type: BlockType): string {
    const colors: Record<BlockType, string> = {
      [BlockType.AIR]: '#0000',
      [BlockType.GRASS]: '#7fb65a',
      [BlockType.DIRT]: '#926544',
      [BlockType.STONE]: '#778081',
      [BlockType.SAND]: '#d9b76e',
      [BlockType.WOOD]: '#9b6a40',
      [BlockType.LEAVES]: '#4c9560',
      [BlockType.WATER]: '#278a94',
      [BlockType.GLOW]: '#ec914f',
    };
    return colors[type];
  }

  private byId(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing HUD element: ${id}`);
    return element;
  }
}
