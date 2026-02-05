/**
 * Shared types for POD (Print-on-Demand) product creation.
 * Used across Printify and Printful integrations.
 */

export type PodProvider = "printify" | "printful";

/** Print area specification (dimensions, position, safe area). */
export interface PrintSpec {
  /** Position label: "front", "back", "left_chest", etc. */
  position: string;
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
  /** Recommended DPI (usually 150-300). */
  dpi?: number;
  /** Area where design won't be cut off. */
  safeArea?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

/** Catalog variant (size/color combo) with its print specs. */
export interface CatalogVariant {
  id: number;
  title: string;
  color?: string;
  size?: string;
  /** Base cost in cents (from provider). */
  priceCents: number;
  /** Print specs can vary by size (e.g. S vs XL). */
  printSpecs: PrintSpec[];
}

/** Catalog blueprint/product template with variants and print specs. */
export interface CatalogBlueprint {
  provider: PodProvider;
  id: string;
  title: string;
  brand: string;
  description: string;
  images: string[];
  printSpecs: PrintSpec[];
  variants: CatalogVariant[];
}

/** Placement strategy for positioning design on print area. */
export type PlacementStrategy =
  | "center"
  | "center-top"
  | "fill"
  | "fit"
  | "left-chest"
  | "pocket"
  | "custom";

/** Result of position calculation (for Printify x/y/scale/angle or Printful position object). */
export interface PositionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  angle: number;
}

/** Result of uploading an image to a provider. */
export interface UploadResult {
  provider: PodProvider;
  imageId: string;
  imageUrl: string;
  width: number;
  height: number;
}

/** Input for creating a single product. */
export interface CreateProductInput {
  provider: PodProvider;
  blueprintId: string;
  printProviderId?: number;
  title: string;
  description: string;
  tags?: string[];
  image: {
    id?: string;
    buffer?: Buffer;
    url?: string;
  };
  printAreas: {
    position: string;
    strategy: PlacementStrategy;
    customPosition?: { x: number; y: number; scale: number };
  }[];
  variants: {
    id: number;
    enabled: boolean;
    priceCents: number;
  }[];
  syncToStore: boolean;
  publish: boolean;
}

/** Result of creating a product. */
export interface CreateProductResult {
  success: boolean;
  provider: PodProvider;
  externalProductId: string;
  mockupUrls: string[];
  localProductId?: string;
  errors?: string[];
}

/** Target for bulk creation (one blueprint + options). */
export interface BulkCreateTarget {
  provider: PodProvider;
  blueprintId: string;
  printProviderId?: number;
  positions: string[];
  placementStrategy: PlacementStrategy;
  variantFilter?: {
    colors?: string[];
    sizes?: string[];
  };
  pricing: {
    type: "markup_percent" | "markup_fixed" | "fixed";
    value: number;
  };
}

/** Input for bulk product creation. */
export interface BulkCreateInput {
  image: Buffer | string;
  title: string;
  description: string;
  targets: BulkCreateTarget[];
  syncToStore: boolean;
}

/** Result of bulk creation. */
export interface BulkCreateResult {
  total: number;
  successful: number;
  failed: number;
  products: CreateProductResult[];
  errors: { blueprintId: string; error: string }[];
}
