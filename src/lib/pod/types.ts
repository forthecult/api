/**
 * Shared types for POD (Print-on-Demand) product creation.
 * Used across Printify and Printful integrations.
 */

/** Input for bulk product creation. */
export interface BulkCreateInput {
  description: string;
  image: Buffer | string;
  syncToStore: boolean;
  targets: BulkCreateTarget[];
  title: string;
}

/** Result of bulk creation. */
export interface BulkCreateResult {
  errors: { blueprintId: string; error: string }[];
  failed: number;
  products: CreateProductResult[];
  successful: number;
  total: number;
}

/** Target for bulk creation (one blueprint + options). */
export interface BulkCreateTarget {
  blueprintId: string;
  placementStrategy: PlacementStrategy;
  positions: string[];
  pricing: {
    type: "fixed" | "markup_fixed" | "markup_percent";
    value: number;
  };
  printProviderId?: number;
  provider: PodProvider;
  variantFilter?: {
    colors?: string[];
    sizes?: string[];
  };
}

/** Catalog blueprint/product template with variants and print specs. */
export interface CatalogBlueprint {
  brand: string;
  description: string;
  id: string;
  images: string[];
  printSpecs: PrintSpec[];
  provider: PodProvider;
  title: string;
  variants: CatalogVariant[];
}

/** Catalog variant (size/color combo) with its print specs. */
export interface CatalogVariant {
  color?: string;
  id: number;
  /** Base cost in cents (from provider). */
  priceCents: number;
  /** Print specs can vary by size (e.g. S vs XL). */
  printSpecs: PrintSpec[];
  size?: string;
  title: string;
}

/** Input for creating a single product. */
export interface CreateProductInput {
  blueprintId: string;
  description: string;
  image: {
    buffer?: Buffer;
    id?: string;
    url?: string;
  };
  printAreas: {
    customPosition?: { scale: number; x: number; y: number };
    position: string;
    strategy: PlacementStrategy;
  }[];
  printProviderId?: number;
  provider: PodProvider;
  publish: boolean;
  syncToStore: boolean;
  tags?: string[];
  title: string;
  variants: {
    enabled: boolean;
    id: number;
    priceCents: number;
  }[];
}

/** Result of creating a product. */
export interface CreateProductResult {
  errors?: string[];
  externalProductId: string;
  localProductId?: string;
  mockupUrls: string[];
  provider: PodProvider;
  success: boolean;
}

/** Placement strategy for positioning design on print area. */
export type PlacementStrategy =
  | "center"
  | "center-top"
  | "custom"
  | "fill"
  | "fit"
  | "left-chest"
  | "pocket";

export type PodProvider = "printful" | "printify";

/** Result of position calculation (for Printify x/y/scale/angle or Printful position object). */
export interface PositionResult {
  angle: number;
  height: number;
  scale: number;
  width: number;
  x: number;
  y: number;
}

/** Print area specification (dimensions, position, safe area). */
export interface PrintSpec {
  /** Recommended DPI (usually 150-300). */
  dpi?: number;
  /** Height in pixels. */
  height: number;
  /** Position label: "front", "back", "left_chest", etc. */
  position: string;
  /** Area where design won't be cut off. */
  safeArea?: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
  /** Width in pixels. */
  width: number;
}

/** Result of uploading an image to a provider. */
export interface UploadResult {
  height: number;
  imageId: string;
  imageUrl: string;
  provider: PodProvider;
  width: number;
}
