export enum BlockType {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  SAND = 4,
  WOOD = 5,
  LEAVES = 6,
  WATER = 7,
  GLOW = 8,
}

export type BlockDefinition = {
  id: BlockType;
  name: string;
  solid: boolean;
  opaque: boolean;
  liquid?: boolean;
  cutout?: boolean;
  emissive?: boolean;
  topTile: number;
  sideTile: number;
  bottomTile: number;
};

export const BLOCKS: Record<BlockType, BlockDefinition> = {
  [BlockType.AIR]: { id: BlockType.AIR, name: 'Air', solid: false, opaque: false, topTile: 0, sideTile: 0, bottomTile: 0 },
  [BlockType.GRASS]: { id: BlockType.GRASS, name: 'Meadow grass', solid: true, opaque: true, topTile: 2, sideTile: 1, bottomTile: 3 },
  [BlockType.DIRT]: { id: BlockType.DIRT, name: 'Rich soil', solid: true, opaque: true, topTile: 3, sideTile: 3, bottomTile: 3 },
  [BlockType.STONE]: { id: BlockType.STONE, name: 'Slate stone', solid: true, opaque: true, topTile: 0, sideTile: 0, bottomTile: 0 },
  [BlockType.SAND]: { id: BlockType.SAND, name: 'Warm sand', solid: true, opaque: true, topTile: 4, sideTile: 4, bottomTile: 4 },
  [BlockType.WOOD]: { id: BlockType.WOOD, name: 'Cedar wood', solid: true, opaque: true, topTile: 5, sideTile: 5, bottomTile: 5 },
  [BlockType.LEAVES]: { id: BlockType.LEAVES, name: 'Canopy leaves', solid: true, opaque: false, cutout: true, topTile: 6, sideTile: 6, bottomTile: 6 },
  [BlockType.WATER]: { id: BlockType.WATER, name: 'Clear water', solid: false, opaque: false, liquid: true, topTile: 0, sideTile: 0, bottomTile: 0 },
  [BlockType.GLOW]: { id: BlockType.GLOW, name: 'Ember crystal', solid: true, opaque: true, emissive: true, topTile: 7, sideTile: 7, bottomTile: 7 },
};

export const HOTBAR_BLOCKS: BlockType[] = [
  BlockType.GRASS,
  BlockType.DIRT,
  BlockType.STONE,
  BlockType.SAND,
  BlockType.WOOD,
  BlockType.GLOW,
];

export function getBlockDefinition(type: BlockType): BlockDefinition {
  return BLOCKS[type] ?? BLOCKS[BlockType.AIR];
}

export function isSolid(type: BlockType): boolean {
  return getBlockDefinition(type).solid;
}

export function isOpaque(type: BlockType): boolean {
  return getBlockDefinition(type).opaque;
}
