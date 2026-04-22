"use client";

import Image from "next/image";
import * as React from "react";

import { cn } from "~/lib/cn";

import { useProductVariantImage } from "./product-variant-image-context";

const PLACEHOLDER_SRC = "/placeholder.svg";

export interface ProductImageGalleryProps {
  className?: string;
  discountPercentage?: number;
  /** Per-image alt text (same order as images). Used when viewing that image. */
  imageAlts?: (null | string)[];
  images: string[];
  /** SEO: alt text for the main (first) product image. Falls back to productName when not set. */
  mainImageAlt?: null | string;
  productName: string;
}

export function ProductImageGallery({
  className,
  discountPercentage = 0,
  imageAlts,
  images,
  mainImageAlt,
  productName,
}: ProductImageGalleryProps) {
  const { selectedVariant } = useProductVariantImage();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [zoomOpen, setZoomOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [zoomPos, setZoomPos] = React.useState({ x: 50, y: 50 });
  /** URLs that failed to load (400, 404, etc.) so we show placeholder instead of breaking the page. */
  const [failedUrls, setFailedUrls] = React.useState<Set<string>>(
    () => new Set(),
  );
  /** After optimizer fails (400/504), retry with unoptimized so browser fetches directly. */
  const [useUnoptimizedUrls, setUseUnoptimizedUrls] = React.useState<
    Set<string>
  >(() => new Set());

  const baseList = React.useMemo(
    () =>
      (images.length > 0 ? images : [PLACEHOLDER_SRC]).map((src) =>
        isExternalImageUrl(src) ? normalizeImageSrc(src) : src,
      ),
    [images],
  );

  // When a variant with imageUrl is selected, show that image first; otherwise use product images
  const list = React.useMemo(() => {
    const variantImage =
      selectedVariant?.imageUrl?.trim() && selectedVariant.imageUrl;
    if (!variantImage) return baseList;
    const normalized = isExternalImageUrl(variantImage)
      ? normalizeImageSrc(variantImage)
      : variantImage;
    const rest = baseList.filter((src) => src !== normalized);
    return [normalized, ...rest];
  }, [baseList, selectedVariant?.imageUrl]);

  // Reset to first image only when the variant image (list[0]) actually changes — e.g. new color.
  // Do not reset when only size (or other option) changes and the mockup is the same.
  const prevListFirstRef = React.useRef<null | string>(null);
  React.useEffect(() => {
    const firstSrc = list[0] ?? null;
    if (firstSrc !== prevListFirstRef.current) {
      prevListFirstRef.current = firstSrc;
      setSelectedIndex(0);
    }
  }, [list]);
  const hasMultiple = list.length > 1;
  const actualMainSrc = list[selectedIndex] ?? list[0];
  const mainSrc =
    failedUrls.has(actualMainSrc) || !actualMainSrc?.trim()
      ? PLACEHOLDER_SRC
      : actualMainSrc;
  const mainAlt = (imageAlts?.[selectedIndex]?.trim() ||
    (selectedIndex === 0 && mainImageAlt?.trim()) ||
    productName) as string;

  const handleMainImageError = React.useCallback(() => {
    if (useUnoptimizedUrls.has(actualMainSrc)) {
      setFailedUrls((prev) => new Set(prev).add(actualMainSrc));
    } else {
      setUseUnoptimizedUrls((prev) => new Set(prev).add(actualMainSrc));
    }
  }, [actualMainSrc, useUnoptimizedUrls]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || list.length === 0) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setZoomPos({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      });
    });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Main image with hover zoom */}
      <div
        className="relative aspect-square overflow-hidden rounded-lg bg-white"
        onClick={() => hasMultiple && setZoomOpen((v) => !v)}
        onMouseEnter={() => setZoomOpen(true)}
        onMouseLeave={() => setZoomOpen(false)}
        onMouseMove={handleMouseMove}
        ref={containerRef}
      >
        <Image
          alt={mainAlt}
          className={cn(
            "object-contain transition-transform duration-150",
            zoomOpen && "scale-150 cursor-zoom-out",
          )}
          fill
          key={`${mainSrc ?? "main"}-${useUnoptimizedUrls.has(actualMainSrc) ? "direct" : "opt"}`}
          onError={handleMainImageError}
          priority={selectedIndex === 0}
          sizes="(max-width: 768px) 100vw, (max-width: 1800px) 50vw, 900px"
          src={mainSrc}
          style={
            zoomOpen
              ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
              : undefined
          }
          unoptimized={
            isExternalImageUrl(mainSrc) || useUnoptimizedUrls.has(actualMainSrc)
          }
        />
        {discountPercentage > 0 && (
          <div
            className={`
              absolute top-2 left-2 rounded-full bg-red-500 px-2 py-1 text-xs
              font-bold text-white
            `}
          >
            -{discountPercentage}%
          </div>
        )}
      </div>

      {/* Thumbnails when multiple images */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((src, i) => {
            const thumbSrc =
              failedUrls.has(src) || !src?.trim() ? PLACEHOLDER_SRC : src;
            const thumbUnoptimized =
              isExternalImageUrl(thumbSrc) || useUnoptimizedUrls.has(src);
            return (
              <button
                aria-label={`View image ${i + 1} of ${list.length}`}
                className={cn(
                  `
                    relative h-16 w-16 shrink-0 overflow-hidden rounded-md
                    border-2 transition-colors
                  `,
                  selectedIndex === i
                    ? "border-primary"
                    : `
                      border-transparent
                      hover:border-muted-foreground/50
                    `,
                )}
                key={i}
                onClick={() => setSelectedIndex(i)}
                type="button"
              >
                <Image
                  alt={
                    imageAlts?.[i]?.trim() ||
                    `View image ${i + 1} of ${list.length}`
                  }
                  className="object-cover"
                  fill
                  key={`${src}-${thumbUnoptimized ? "direct" : "opt"}`}
                  onError={() => {
                    if (useUnoptimizedUrls.has(src)) {
                      setFailedUrls((prev) => new Set(prev).add(src));
                    } else {
                      setUseUnoptimizedUrls((prev) => new Set(prev).add(src));
                    }
                  }}
                  sizes="64px"
                  src={thumbSrc}
                  unoptimized={thumbUnoptimized}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Only data: and http: skip Next Image optimization; https remotes use remotePatterns. */
function isExternalImageUrl(src: string): boolean {
  const s = src?.trim() ?? "";
  return s.startsWith("data:") || s.startsWith("http://");
}

/** Prefer https for external URLs to avoid mixed-content blocking on HTTPS pages. */
function normalizeImageSrc(src: string): string {
  const s = src?.trim() ?? "";
  if (s.startsWith("http://")) return `https://${s.slice(7)}`;
  return s;
}
