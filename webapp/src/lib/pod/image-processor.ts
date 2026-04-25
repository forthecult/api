/**
 * Image processing for POD: validate, resize, and enhance images to meet print requirements.
 */

import sharp from "sharp";

import type { PrintSpec } from "./types";

export interface ImageAnalysis {
  dominantColors: string[];
  effectiveDpi: number;
  format: string;
  hasTransparency: boolean;
  height: number;
  width: number;
}

export interface ProcessingOptions {
  /** Target DPI for effectiveDpi calculation (assume 6" print width if not specified). */
  assumedPrintWidthInches?: number;
  /** Background color for padding (e.g. "#ffffff"). */
  backgroundColor?: string;
  /** Output format. */
  format?: "jpeg" | "png";
  /** Maintain aspect ratio when resizing (default true). */
  maintainAspectRatio?: boolean;
  /** JPEG quality 1-100. */
  quality?: number;
}

export interface ProcessingResult {
  analysis: ImageAnalysis;
  buffer: Buffer;
  meetsRequirements: boolean;
  warnings: string[];
}

export interface ValidationResult {
  analysis?: ImageAnalysis;
  errors: string[];
  valid: boolean;
  warnings: string[];
}

const DEFAULT_DPI = 150;
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 15000;

/**
 * Analyze an image buffer: dimensions, format, transparency, rough color info.
 */
export async function analyzeImage(buffer: Buffer): Promise<ImageAnalysis> {
  const meta = await sharp(buffer).metadata();
  const { format = "unknown", height = 0, width = 0 } = meta;
  const channels = meta.channels ?? 3;
  const hasTransparency = format === "png" || (channels === 4 && meta.hasAlpha);
  const assumedWidthInches = 6;
  const effectiveDpi = width > 0 ? Math.round(width / assumedWidthInches) : 0;

  return {
    dominantColors: [],
    effectiveDpi,
    format: String(format),
    hasTransparency: Boolean(hasTransparency),
    height,
    width,
  };
}

/**
 * Light sharpening and optional resize for print quality (e.g. admin upload enhancement).
 */
export async function enhanceForPrint(
  buffer: Buffer,
  targetDpi: number = DEFAULT_DPI,
): Promise<ProcessingResult> {
  const analysis = await analyzeImage(buffer);
  const warnings: string[] = [];

  let pipeline = sharp(buffer).sharpen({ sigma: 0.5 });

  const assumedWidthInches = 6;
  const currentDpi = analysis.width / assumedWidthInches;
  if (currentDpi < targetDpi * 0.9 && analysis.width > 0) {
    const scale = (targetDpi * assumedWidthInches) / analysis.width;
    const newWidth = Math.round(analysis.width * scale);
    const newHeight = Math.round(analysis.height * scale);
    pipeline = pipeline.resize(newWidth, newHeight, { fit: "fill" });
    warnings.push(
      "Image was upscaled for print DPI; consider using a higher-resolution source.",
    );
  }

  const outBuffer = await pipeline.png().toBuffer();
  const outMeta = await sharp(outBuffer).metadata();

  return {
    analysis: {
      ...analysis,
      effectiveDpi: targetDpi,
      height: outMeta.height ?? analysis.height,
      width: outMeta.width ?? analysis.width,
    },
    buffer: outBuffer,
    meetsRequirements: warnings.length === 0,
    warnings,
  };
}

/**
 * Make dark/near-black background transparent. For print files that have a black
 * background but should be transparent on merchandise.
 * @param buffer - PNG/JPEG buffer
 * @param threshold - RGB values <= this become transparent (default 30)
 */
export async function makeBackgroundTransparent(
  buffer: Buffer,
  threshold = 30,
): Promise<Buffer> {
  const img = sharp(buffer);
  const { data, info } = await img
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels ?? 4;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r <= threshold && g <= threshold && b <= threshold) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, {
    raw: {
      channels: 4,
      height: info.height,
      width: info.width,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Resize (and optionally pad) image to fit a print area. Maintains aspect ratio by default.
 */
export async function resizeForPrintArea(
  buffer: Buffer,
  printSpec: PrintSpec,
  options: ProcessingOptions = {},
): Promise<ProcessingResult> {
  const {
    assumedPrintWidthInches = 6,
    backgroundColor = "#ffffff",
    format = "png",
    maintainAspectRatio = true,
    quality = 90,
  } = options;

  const warnings: string[] = [];
  const targetWidth = printSpec.width;
  const targetHeight = printSpec.height;

  let pipeline = sharp(buffer);
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width < targetWidth || height < targetHeight) {
    warnings.push("Image was upscaled to fit print area; may appear blurry.");
  }

  if (maintainAspectRatio) {
    const scale = Math.min(targetWidth / width, targetHeight / height);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);
    const resized = await sharp(buffer)
      .resize(newWidth, newHeight, { fit: "inside" })
      .toBuffer();
    const left = Math.round((targetWidth - newWidth) / 2);
    const top = Math.round((targetHeight - newHeight) / 2);
    pipeline = sharp({
      create: {
        background: backgroundColor,
        channels: format === "png" ? 4 : 3,
        height: targetHeight,
        width: targetWidth,
      },
    }).composite([{ input: resized, left, top }]);
  } else {
    pipeline = pipeline.resize(targetWidth, targetHeight, { fit: "fill" });
  }

  if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality });
  } else {
    pipeline = pipeline.png();
  }

  const outBuffer = await pipeline.toBuffer();
  const outMeta = await sharp(outBuffer).metadata();
  const effectiveDpi =
    (outMeta.width ?? 0) > 0
      ? Math.round((outMeta.width ?? 0) / assumedPrintWidthInches)
      : 0;

  const analysis: ImageAnalysis = {
    dominantColors: [],
    effectiveDpi,
    format: format === "jpeg" ? "jpeg" : "png",
    hasTransparency: format === "png",
    height: outMeta.height ?? targetHeight,
    width: outMeta.width ?? targetWidth,
  };

  return {
    analysis,
    buffer: outBuffer,
    meetsRequirements:
      warnings.filter((w) => w.includes("upscaled")).length === 0,
    warnings,
  };
}

/**
 * Validate an image against a print spec (dimensions, format).
 */
export async function validateForPrint(
  buffer: Buffer,
  printSpec: PrintSpec,
): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  let analysis: ImageAnalysis;

  try {
    analysis = await analyzeImage(buffer);
  } catch (_e) {
    return {
      errors: ["Failed to read image"],
      valid: false,
      warnings: [],
    };
  }

  if (analysis.width < MIN_DIMENSION || analysis.height < MIN_DIMENSION) {
    errors.push(
      `Image too small: ${analysis.width}x${analysis.height}. Minimum ${MIN_DIMENSION}px on each side.`,
    );
  }
  if (analysis.width > MAX_DIMENSION || analysis.height > MAX_DIMENSION) {
    warnings.push(
      `Image very large: ${analysis.width}x${analysis.height}. May be slow to process.`,
    );
  }
  if (analysis.width < printSpec.width || analysis.height < printSpec.height) {
    warnings.push(
      `Image (${analysis.width}x${analysis.height}) is smaller than print area (${printSpec.width}x${printSpec.height}). Upscaling may reduce quality.`,
    );
  }
  const targetDpi = printSpec.dpi ?? DEFAULT_DPI;
  if (analysis.effectiveDpi < targetDpi * 0.8) {
    warnings.push(
      `Effective resolution (~${analysis.effectiveDpi} DPI) is below recommended ${targetDpi} DPI for print.`,
    );
  }

  return {
    analysis,
    errors,
    valid: errors.length === 0,
    warnings,
  };
}
