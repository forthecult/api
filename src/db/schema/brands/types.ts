import type { InferSelectModel } from "drizzle-orm";

import type { brandAssetTable, brandTable } from "./tables";

export type Brand = InferSelectModel<typeof brandTable>;
export type BrandAsset = InferSelectModel<typeof brandAssetTable>;
