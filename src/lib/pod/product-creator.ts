/**
 * Create POD products in Printify or Printful with image and positioning.
 */

import { createSyncProduct } from "@/lib/printful";
import { importSinglePrintfulProduct } from "@/lib/printful-sync";
import {
  createPrintifyProduct,
  getPrintifyShopId,
  publishPrintifyProduct,
} from "@/lib/printify";
import { importSinglePrintifyProduct } from "@/lib/printify-sync";

import type {
  CreateProductInput,
  CreateProductResult,
  PlacementStrategy,
  PodProvider,
  PrintSpec,
} from "./types";

import { fetchBlueprintWithSpecs } from "./catalog";
import {
  calculatePosition,
  toPrintfulPosition,
  toPrintifyPosition,
} from "./position-calculator";
import { uploadToPrintful, uploadToPrintify } from "./upload";

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
      errors: ["At least one variant must be enabled"],
      externalProductId: "",
      mockupUrls: [],
      provider: input.provider,
      success: false,
    };
  }

  if (input.provider === "printify") {
    if (input.printProviderId == null) {
      return {
        errors: ["printProviderId is required for Printify"],
        externalProductId: "",
        mockupUrls: [],
        provider: "printify",
        success: false,
      };
    }
    const shopId = getPrintifyShopId();
    const variantIds = enabledVariants.map((v) => v.id);
    const printAreasPayload = input.printAreas.map((pa) => {
      const spec = findPrintSpec(blueprint.printSpecs, pa.position);
      if (!spec) {
        errors.push(`Print position "${pa.position}" not found on blueprint`);
        return { placeholders: [], variant_ids: variantIds };
      }
      const strategy: PlacementStrategy = pa.customPosition
        ? "custom"
        : pa.strategy;
      const pos = pa.customPosition
        ? {
            angle: 0,
            height: spec.height,
            scale: pa.customPosition.scale,
            width: spec.width,
            x: pa.customPosition.x,
            y: pa.customPosition.y,
          }
        : calculatePosition(spec.width, spec.height, spec, strategy);
      const py = toPrintifyPosition(pos, spec);
      return {
        placeholders: [
          {
            images: [
              {
                angle: py.angle,
                id: imageId,
                scale: py.scale,
                x: py.x,
                y: py.y,
              },
            ],
            position: pa.position,
          },
        ],
        variant_ids: variantIds,
      };
    });

    try {
      const product = await createPrintifyProduct(shopId, {
        blueprint_id: parseInt(blueprint.id, 10),
        description: input.description,
        print_areas: printAreasPayload,
        print_provider_id: input.printProviderId,
        tags: input.tags,
        title: input.title,
        variants: enabledVariants.map((v) => ({
          id: v.id,
          is_enabled: true,
          price: v.priceCents,
        })),
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
        errors: errors.length ? errors : undefined,
        externalProductId: product.id,
        localProductId,
        mockupUrls,
        provider: "printify",
        success: true,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        errors: [msg],
        externalProductId: "",
        mockupUrls: [],
        provider: "printify",
        success: false,
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
              angle: 0,
              height: specForVariant.height,
              scale: pa.customPosition.scale,
              width: specForVariant.width,
              x: pa.customPosition.x,
              y: pa.customPosition.y,
            }
          : calculatePosition(
              specForVariant.width,
              specForVariant.height,
              specForVariant,
              strategy,
            );
        const pfPos = toPrintfulPosition(pos, specForVariant);
        return { position: pfPos, type, url: imageUrl };
      });
      return {
        files,
        retail_price: (v.priceCents / 100).toFixed(2),
        variant_id: v.id,
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
        errors: errors.length ? errors : undefined,
        externalProductId: String(syncProduct.id),
        localProductId,
        mockupUrls: [imageUrl],
        provider: "printful",
        success: true,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        errors: [msg],
        externalProductId: "",
        mockupUrls: [],
        provider: "printful",
        success: false,
      };
    }
  }

  return {
    errors: ["Unsupported provider"],
    externalProductId: "",
    mockupUrls: [],
    provider: input.provider,
    success: false,
  };
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
