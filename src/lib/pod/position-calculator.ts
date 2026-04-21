/**
 * Smart position calculator for placing designs on print areas.
 * Used by AI and product creator to get x, y, scale, angle for Printify/Printful.
 */

import type { PlacementStrategy, PositionResult, PrintSpec } from "./types";

const DEFAULT_PADDING_PERCENT = 0.1;
const LEFT_CHEST_SCALE = 0.2;
const POCKET_SCALE = 0.25;

/**
 * Calculate position and dimensions for an image on a print area.
 * Returns values suitable for Printify (0-1 relative x, y, scale, angle) or
 * Printful (pixel top, left, width, height).
 */
export function calculatePosition(
  imageWidth: number,
  imageHeight: number,
  printSpec: PrintSpec,
  strategy: PlacementStrategy,
  options?: { maxScale?: number; padding?: number },
): PositionResult {
  const padding = options?.padding ?? DEFAULT_PADDING_PERCENT;
  const maxScale = options?.maxScale ?? 1;
  const areaW = printSpec.width;
  const areaH = printSpec.height;
  const _imageAspect = imageWidth / imageHeight;
  const _areaAspect = areaW / areaH;

  let width: number;
  let height: number;
  let x: number;
  let y: number;
  let scale: number;

  switch (strategy) {
    case "center": {
      const padW = areaW * padding;
      const padH = areaH * padding;
      const innerW = areaW - 2 * padW;
      const innerH = areaH - 2 * padH;
      const scaleW = innerW / imageWidth;
      const scaleH = innerH / imageHeight;
      const s = Math.min(scaleW, scaleH, maxScale);
      width = Math.round(imageWidth * s);
      height = Math.round(imageHeight * s);
      x = padW + (innerW - width) / 2;
      y = padH + (innerH - height) / 2;
      scale = s;
      break;
    }
    case "center-top": {
      const padW = areaW * padding;
      const usableH = areaH * (1 - padding);
      const innerW = areaW - 2 * padW;
      const scaleW = innerW / imageWidth;
      const scaleH = usableH / imageHeight;
      const s = Math.min(scaleW, scaleH, maxScale);
      width = Math.round(imageWidth * s);
      height = Math.round(imageHeight * s);
      x = padW + (innerW - width) / 2;
      y = areaH * 0.15;
      scale = s;
      break;
    }
    case "fill": {
      width = areaW;
      height = areaH;
      x = 0;
      y = 0;
      scale = 1;
      break;
    }
    case "fit": {
      const scaleW = areaW / imageWidth;
      const scaleH = areaH / imageHeight;
      const s = Math.min(scaleW, scaleH, maxScale);
      width = Math.round(imageWidth * s);
      height = Math.round(imageHeight * s);
      x = (areaW - width) / 2;
      y = (areaH - height) / 2;
      scale = s;
      break;
    }
    case "left-chest": {
      const size = Math.min(areaW, areaH) * LEFT_CHEST_SCALE;
      const s = Math.min(size / imageWidth, size / imageHeight, maxScale);
      width = Math.round(imageWidth * s);
      height = Math.round(imageHeight * s);
      x = areaW * 0.2 - width / 2;
      y = areaH * 0.25 - height / 2;
      scale = s;
      break;
    }
    case "pocket": {
      const size = Math.min(areaW, areaH) * POCKET_SCALE;
      const s = Math.min(size / imageWidth, size / imageHeight, maxScale);
      width = Math.round(imageWidth * s);
      height = Math.round(imageHeight * s);
      x = areaW * 0.5 - width / 2;
      y = areaH * 0.4 - height / 2;
      scale = s;
      break;
    }
    default: {
      const scaleW = areaW / imageWidth;
      const scaleH = areaH / imageHeight;
      const s = Math.min(scaleW, scaleH, maxScale);
      width = Math.round(imageWidth * s);
      height = Math.round(imageHeight * s);
      x = (areaW - width) / 2;
      y = (areaH - height) / 2;
      scale = s;
      break;
    }
  }

  return {
    angle: 0,
    height,
    scale: Math.min(scale, maxScale),
    width,
    x,
    y,
  };
}

/**
 * Suggest placement strategy based on image aspect ratio, print position, and product type.
 * Used by AI to choose how to place a design.
 */
export function suggestStrategy(
  imageAspectRatio: number,
  printPosition: string,
  productType: string,
): PlacementStrategy {
  const position = printPosition.toLowerCase();
  const type = productType.toLowerCase();

  if (position.includes("left") && position.includes("chest"))
    return "left-chest";
  if (position.includes("pocket")) return "pocket";
  if (
    position.includes("back") &&
    (type.includes("shirt") || type.includes("hoodie"))
  )
    return "center";
  if (position.includes("front")) {
    if (
      type.includes("shirt") ||
      type.includes("tee") ||
      type.includes("hoodie")
    )
      return imageAspectRatio > 1.2 ? "center-top" : "center";
    if (type.includes("mug")) return imageAspectRatio > 2 ? "fit" : "fill";
  }
  if (type.includes("poster") || type.includes("canvas")) return "fit";
  if (type.includes("mug") || type.includes("all-over")) return "fill";

  return "center";
}

/**
 * Normalize position result to Printful format (pixel position for order API).
 */
export function toPrintfulPosition(
  pos: PositionResult,
  printSpec: PrintSpec,
): {
  area_height: number;
  area_width: number;
  height: number;
  left: number;
  top: number;
  width: number;
} {
  return {
    area_height: printSpec.height,
    area_width: printSpec.width,
    height: pos.height,
    left: Math.round(pos.x),
    top: Math.round(pos.y),
    width: pos.width,
  };
}

/**
 * Normalize position result to Printify format (0-1 relative coordinates).
 */
export function toPrintifyPosition(
  pos: PositionResult,
  printSpec: PrintSpec,
): {
  angle: number;
  scale: number;
  x: number;
  y: number;
} {
  return {
    angle: pos.angle,
    scale: pos.scale,
    x: pos.x / printSpec.width + pos.width / printSpec.width / 2,
    y: pos.y / printSpec.height + pos.height / printSpec.height / 2,
  };
}
