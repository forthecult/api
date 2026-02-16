"use client";

import Image from "next/image";
import * as React from "react";

import { cn } from "~/lib/cn";

import { useProductVariantImage } from "./product-variant-image-context";

const PLACEHOLDER_SRC = "/placeholder.svg";

export interface ProductImageGalleryProps {
  className?: string;
  discountPercentage?: number;
  images: string[];
  /** SEO: alt text for the main (first) product image. Falls back to productName when not set. */
  mainImageAlt?: null | string;
  productName: string;
}

export function ProductImageGallery({
  className,
  discountPercentage = 0,
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

  // Reset to first image when selected variant (and thus list) changes so the variant image is shown
  const prevVariantIdRef = React.useRef<null | string>(null);
  React.useEffect(() => {
    const id = selectedVariant?.id ?? null;
    if (id !== prevVariantIdRef.current) {
      prevVariantIdRef.current = id;
      setSelectedIndex(0);
    }
  }, [selectedVariant?.id]);
  const hasMultiple = list.length > 1;
  const actualMainSrc = list[selectedIndex] ?? list[0];
  const mainSrc =
    failedUrls.has(actualMainSrc) || !actualMainSrc?.trim()
      ? PLACEHOLDER_SRC
      : actualMainSrc;
  const mainAlt =
    selectedIndex === 0 && mainImageAlt?.trim()
      ? mainImageAlt.trim()
      : productName;

  const handleMainImageError = React.useCallback(() => {
    setFailedUrls((prev) => new Set(prev).add(actualMainSrc));
  }, [actualMainSrc]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || list.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
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
          key={selectedVariant?.id ?? mainSrc ?? "main"}
          onError={handleMainImageError}
          priority={!selectedVariant?.id}
          sizes="(max-width: 768px) 100vw, (max-width: 1800px) 50vw, 900px"
          src={mainSrc}
          style={
            zoomOpen
              ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
              : undefined
          }
          unoptimized={isExternalImageUrl(mainSrc)}
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
                  alt=""
                  className="object-cover"
                  fill
                  onError={() =>
                    setFailedUrls((prev) => new Set(prev).add(src))
                  }
                  sizes="64px"
                  src={thumbSrc}
                  unoptimized={isExternalImageUrl(thumbSrc)}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isExternalImageUrl(src: string): boolean {
  return /^https?:\/\//i.test(src?.trim() ?? "");
}

/** Prefer https for external URLs to avoid mixed-content blocking on HTTPS pages. */
function normalizeImageSrc(src: string): string {
  const s = src?.trim() ?? "";
  if (s.startsWith("http://")) return "https://" + s.slice(7);
  return s;
}
