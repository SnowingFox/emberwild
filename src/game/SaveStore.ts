import { BlockType } from '../world/BlockTypes';
import { WORLD_SEED } from '../world/constants';
import type { WorldEdit } from '../world/VoxelWorld';

const SAVE_KEY = 'emberwild-save-v1';

type SaveData = { seed: number; edits: WorldEdit[]; selectedSlot: number };

export class SaveStore {
  load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { seed: WORLD_SEED, edits: [], selectedSlot: 0 };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const edits = Array.isArray(parsed.edits) ? parsed.edits.filter((edit): edit is WorldEdit => Boolean(edit && typeof edit.x === 'number' && typeof edit.y === 'number' && typeof edit.z === 'number' && typeof edit.type === 'number')) : [];
      return { seed: typeof parsed.seed === 'number' ? parsed.seed : WORLD_SEED, edits, selectedSlot: typeof parsed.selectedSlot === 'number' ? parsed.selectedSlot : 0 };
    } catch {
      return { seed: WORLD_SEED, edits: [], selectedSlot: 0 };
    }
  }

  save(seed: number, edits: WorldEdit[], selectedSlot: number): void {
    try {
      const data: SaveData = { seed, edits, selectedSlot };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage is optional; the world remains playable without it.
    }
  }

  reset(): void {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* no-op */ }
  }

  static isValidBlockType(type: number): type is BlockType {
    return Number.isInteger(type) && type >= 0 && type <= 8;
  }
}
