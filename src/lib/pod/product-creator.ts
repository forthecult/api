/**
 * Create POD products in Printify or Printful with image and positioning.
 */

import {
  createPrintifyProduct,
  getPrintifyShopId,
  publishPrintifyProduct,
} from "@/lib/printify";
import { createSyncProduct } from "@/lib/printful";
import { importSinglePrintifyProduct } from "@/lib/printify-sync";
import { importSinglePrintfulProduct } from "@/lib/printful-sync";
import { fetchBlueprintWithSpecs } from "./catalog";
import {
  calculatePosition,
  toPrintifyPosition,
  toPrintfulPosition,
} from "./position-calculator";
import { uploadToPrintify, uploadToPrintful } from "./upload";
import type {
  CreateProductInput,
  CreateProductResult,
  PlacementStrategy,
  PodProvider,
  PrintSpec,
} from "./types";

/**
 * Resolve image to provider-specific id/url. Upload buffer if needed.
 */
async function resolveImage(
  provider: PodProvider,
  image: CreateProductInput["image"],
): Promise<{ imageId: string; imageUrl: string }> {
  if (image.id && image.url) {
    return { imageId: image.id, imageUrl: image.url };
  }
  if (image.buffer) {
    if (provider === "printify") {
      const result = await uploadToPrintify(image.buffer, "design.png");
      return { imageId: result.imageId, imageUrl: result.imageUrl };
    }
    throw new Error(
      "Printful requires image.url for product creation. Upload image to a public URL first.",
    );
  }
  if (image.url && provider === "printful") {
    const result = await uploadToPrintful(image.url);
    return { imageId: result.imageId, imageUrl: result.imageUrl };
  }
  throw new Error(
    "Product image must provide id, url, or buffer (Printify only for buffer).",
  );
}

function findPrintSpec(
  printSpecs: PrintSpec[],
  position: string,
): PrintSpec | undefined {
  return printSpecs.find(
    (p) => p.position.toLowerCase() === position.toLowerCase(),
  );
}

/**
 * Create a single product in Printify or Printful.
 */
export async function createProduct(
  input: CreateProductInput,
): Promise<CreateProductResult> {
  const errors: string[] = [];
  const blueprint = await fetchBlueprintWithSpecs(
    input.provider,
    input.blueprintId,
    input.printProviderId,
  );

  const { imageId, imageUrl } = await resolveImage(input.provider, input.image);

  const enabledVariants = input.variants.filter((v) => v.enabled);
  if (enabledVariants.length === 0) {
    return {
      success: false,
      provider: input.provider,
      externalProductId: "",
      mockupUrls: [],
      errors: ["At least one variant must be enabled"],
    };
  }

  if (input.provider === "printify") {
    if (input.printProviderId == null) {
      return {
        success: false,
        provider: "printify",
        externalProductId: "",
        mockupUrls: [],
        errors: ["printProviderId is required for Printify"],
      };
    }
    const shopId = getPrintifyShopId();
    const variantIds = enabledVariants.map((v) => v.id);
    const printAreasPayload = input.printAreas.map((pa) => {
      const spec = findPrintSpec(blueprint.printSpecs, pa.position);
      if (!spec) {
        errors.push(`Print position "${pa.position}" not found on blueprint`);
        return { variant_ids: variantIds, placeholders: [] };
      }
      const strategy: PlacementStrategy = pa.customPosition
        ? "custom"
        : pa.strategy;
      const pos = pa.customPosition
        ? {
            x: pa.customPosition.x,
            y: pa.customPosition.y,
            width: spec.width,
            height: spec.height,
            scale: pa.customPosition.scale,
            angle: 0,
          }
        : calculatePosition(spec.width, spec.height, spec, strategy);
      const py = toPrintifyPosition(pos, spec);
      return {
        variant_ids: variantIds,
        placeholders: [
          {
            position: pa.position,
            images: [
              {
                id: imageId,
                x: py.x,
                y: py.y,
                scale: py.scale,
                angle: py.angle,
              },
            ],
          },
        ],
      };
    });

    try {
      const product = await createPrintifyProduct(shopId, {
        title: input.title,
        description: input.description,
        blueprint_id: parseInt(blueprint.id, 10),
        print_provider_id: input.printProviderId,
        variants: enabledVariants.map((v) => ({
          id: v.id,
          price: v.priceCents,
          is_enabled: true,
        })),
        print_areas: printAreasPayload,
        tags: input.tags,
      });
      const mockupUrls = product.images?.map((i) => i.src) ?? [];
      if (input.publish) {
        await publishPrintifyProduct(shopId, product.id).catch(() => {});
      }
      let localProductId: string | undefined;
      if (input.syncToStore) {
        try {
          const imported = await importSinglePrintifyProduct(product.id, false);
          localProductId = imported?.productId;
        } catch {
          // sync may fail if webhook will handle it
        }
      }
      return {
        success: true,
        provider: "printify",
        externalProductId: product.id,
        mockupUrls,
        localProductId,
        errors: errors.length ? errors : undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        provider: "printify",
        externalProductId: "",
        mockupUrls: [],
        errors: [msg],
      };
    }
  }

  if (input.provider === "printful") {
    const syncVariants = enabledVariants.map((v) => {
      const files = input.printAreas.map((pa) => {
        const spec = findPrintSpec(blueprint.printSpecs, pa.position);
        const specForVariant =
          blueprint.variants
            .find((bv) => bv.id === v.id)
            ?.printSpecs?.find(
              (p) => p.position.toLowerCase() === pa.position.toLowerCase(),
            ) ?? spec;
        const type = pa.position === "front" ? "default" : pa.position;
        if (!specForVariant) {
          return { type, url: imageUrl };
        }
        const strategy: PlacementStrategy = pa.customPosition
          ? "custom"
          : pa.strategy;
        const pos = pa.customPosition
          ? {
              x: pa.customPosition.x,
              y: pa.customPosition.y,
              width: specForVariant.width,
              height: specForVariant.height,
              scale: pa.customPosition.scale,
              angle: 0,
            }
          : calculatePosition(
              specForVariant.width,
              specForVariant.height,
              specForVariant,
              strategy,
            );
        const pfPos = toPrintfulPosition(pos, specForVariant);
        return { type, url: imageUrl, position: pfPos };
      });
      return {
        variant_id: v.id,
        retail_price: (v.priceCents / 100).toFixed(2),
        files,
      };
    });

    try {
      const syncProduct = await createSyncProduct({
        sync_product: {
          name: input.title,
          thumbnail: imageUrl,
        },
        sync_variants: syncVariants,
      });
      let localProductId: string | undefined;
      if (input.syncToStore) {
        try {
          const imported = await importSinglePrintfulProduct(
            syncProduct.id,
            false,
          );
          localProductId = imported?.productId;
        } catch {
          // sync may fail if webhook will handle it
        }
      }
      return {
        success: true,
        provider: "printful",
        externalProductId: String(syncProduct.id),
        mockupUrls: [imageUrl],
        localProductId,
        errors: errors.length ? errors : undefined,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        provider: "printful",
        externalProductId: "",
        mockupUrls: [],
        errors: [msg],
      };
    }
  }

  return {
    success: false,
    provider: input.provider,
    externalProductId: "",
    mockupUrls: [],
    errors: ["Unsupported provider"],
  };
}
