export type PosterSizeId = 'A6' | 'A5' | 'A4' | 'A3';
export type PosterOrientation = 'portrait' | 'landscape';
export type PosterArtworkSource = 'collection' | 'custom';
export type PosterMaterialId = 'matte' | 'glossy' | 'rigid_board';

export interface PosterMaterialConfig {
  id: PosterMaterialId;
  name: string;
  shortDesc: string;
  description: string;
}

export const POSTER_MATERIALS: Record<PosterMaterialId, PosterMaterialConfig> = {
  matte: {
    id: 'matte',
    name: 'Matte',
    shortDesc: 'Smooth & Non-Reflective',
    description: 'Smooth, non-reflective finish.',
  },
  glossy: {
    id: 'glossy',
    name: 'Glossy',
    shortDesc: 'Shiny & Vibrant Colors',
    description: 'Shiny finish with vibrant-looking colors.',
  },
  rigid_board: {
    id: 'rigid_board',
    name: 'Rigid Board',
    shortDesc: 'Sturdy Rigid Backing',
    description: 'Sturdy poster mounted on a rigid backing.',
  },
};

export const AVAILABLE_MATERIALS: PosterMaterialConfig[] = [
  POSTER_MATERIALS.matte,
  POSTER_MATERIALS.glossy,
  POSTER_MATERIALS.rigid_board,
];

export interface PosterArtwork {
  source: PosterArtworkSource;
  url: string;
  originalArtworkUrl?: string;
  productId?: number | string;
  title?: string;
  isBlobUrl?: boolean;
  customArtworkId?: string;
  mockupUrl?: string;
  image_thumbnail_url?: string | null;
  image_card_url?: string | null;
  image_preview_url?: string | null;
  customArtworkFileName?: string;
}

export interface PosterSizeConfig {
  id: PosterSizeId;
  name: string;
  dimensionsInches: string;
  dimensionsMm: string;
  widthMm: number;
  heightMm: number;
  aspectRatio: number; // width / height = 1 / sqrt(2) ≈ 0.7071
}

export interface PlacedPoster {
  id: string;
  sizeId: PosterSizeId;
  orientation?: PosterOrientation; // Defaults safely to 'portrait' if undefined
  material?: PosterMaterialId; // Defaults safely to 'matte' if undefined
  xPercent: number; // Left coordinate as percentage of container width
  yPercent: number; // Top coordinate as percentage of container height
  widthPercent: number; // Width as percentage of container width
  heightPercent: number; // Height as percentage of container height
  label: string;
  artwork?: PosterArtwork;
  artworkUrl?: string;
  originalArtworkUrl?: string;
  artworkSource?: PosterArtworkSource;
  artworkProductId?: number | string;
  collectionProductId?: number | string;
  artworkTitle?: string;
  customArtworkId?: string;
  mockupUrl?: string;
  image_thumbnail_url?: string | null;
  image_card_url?: string | null;
  image_preview_url?: string | null;
  customArtworkFileName?: string;
}

export interface WallBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface RectBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

