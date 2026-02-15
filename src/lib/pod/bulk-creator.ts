/**
 * Bulk create POD products from one image across multiple blueprints.
 * Respects provider rate limits with simple delays.
 */

import type {
  BulkCreateInput,
  BulkCreateResult,
  CreateProductResult,
  PodProvider,
} from "./types";

import { fetchBlueprintWithSpecs } from "./catalog";
import { createProduct } from "./product-creator";

const PRINTIFY_DELAY_MS = 350; // ~170/min under 200/30min publish limit
const PRINTFUL_DELAY_MS = 550; // ~110/min under 120/min

/**
 * Create products across all targets. One image applied to multiple blueprints.
 * Rate limits: delays between requests per provider.
 */
export async function bulkCreate(
  input: BulkCreateInput,
): Promise<BulkCreateResult> {
  const results: CreateProductResult[] = [];
  const errors: { blueprintId: string; error: string }[] = [];
  let imageBuffer: Buffer | null = null;
  let imageUrl: null | string = null;
  if (typeof input.image === "string") {
    if (input.image.startsWith("http")) {
      imageUrl = input.image;
    } else {
      try {
        imageBuffer = Buffer.from(input.image, "base64");
      } catch {
        return {
          errors: [{ blueprintId: "*", error: "Invalid base64 image" }],
          failed: input.targets.length,
          products: [],
          successful: 0,
          total: input.targets.length,
        };
      }
    }
  } else {
    imageBuffer = input.image;
  }
  for (let i = 0; i < input.targets.length; i++) {
    const target = input.targets[i];
    const provider = target.provider as PodProvider;
    if (i > 0) {
      await delay(
        provider === "printify" ? PRINTIFY_DELAY_MS : PRINTFUL_DELAY_MS,
      );
    }
    try {
      if (provider === "printful" && imageBuffer != null) {
        errors.push({
          blueprintId: target.blueprintId,
          error:
            "Printful bulk create requires image as public URL string, not buffer",
        });
        continue;
      }
      const blueprint = await fetchBlueprintWithSpecs(
        provider,
        target.blueprintId,
        target.printProviderId,
      );
      const enabledVariants = blueprint.variants;
      if (enabledVariants.length === 0) {
        errors.push({
          blueprintId: target.blueprintId,
          error: "Blueprint has no variants",
        });
        continue;
      }
      const basePriceCents = enabledVariants[0]?.priceCents ?? 0;
      const priceCents =
        target.pricing.type === "fixed"
          ? target.pricing.value
          : target.pricing.type === "markup_percent"
            ? Math.round(basePriceCents * (1 + target.pricing.value / 100))
            : basePriceCents + target.pricing.value;
      const variantIds = target.variantFilter
        ? enabledVariants
            .filter((v) => {
              if (
                target.variantFilter!.colors?.length &&
                v.color &&
                !target.variantFilter!.colors!.includes(v.color)
              )
                return false;
              if (
                target.variantFilter!.sizes?.length &&
                v.size &&
                !target.variantFilter!.sizes!.includes(v.size)
              )
                return false;
              return true;
            })
            .map((v) => v.id)
        : enabledVariants.map((v) => v.id);
      if (variantIds.length === 0) {
        errors.push({
          blueprintId: target.blueprintId,
          error: "No variants match filter",
        });
        continue;
      }
      const result = await createProduct({
        blueprintId: target.blueprintId,
        description: input.description,
        image:
          imageBuffer != null
            ? { buffer: imageBuffer }
            : imageUrl != null
              ? { url: imageUrl }
              : { id: "", url: "" },
        printAreas: target.positions.map((position) => ({
          position,
          strategy: target.placementStrategy,
        })),
        printProviderId: target.printProviderId,
        provider,
        publish: false,
        syncToStore: input.syncToStore,
        title: input.title,
        variants: variantIds.map((id) => ({
          enabled: true,
          id,
          priceCents,
        })),
      });
      if (result.success) {
        results.push(result);
      } else {
        errors.push({
          blueprintId: target.blueprintId,
          error: result.errors?.join("; ") ?? "Unknown error",
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ blueprintId: target.blueprintId, error: message });
    }
  }
  return {
    errors,
    failed: errors.length,
    products: results,
    successful: results.length,
    total: input.targets.length,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
