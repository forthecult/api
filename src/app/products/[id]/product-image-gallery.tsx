"use client";

import Image from "next/image";
import * as React from "react";

import { cn } from "~/lib/cn";

export interface ProductImageGalleryProps {
  images: string[];
  productName: string;
  discountPercentage?: number;
  className?: string;
}

export function ProductImageGallery({
  images,
  productName,
  discountPercentage = 0,
  className,
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [zoomOpen, setZoomOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [zoomPos, setZoomPos] = React.useState({ x: 50, y: 50 });

  const list = images.length > 0 ? images : ["/placeholder.svg"];
  const mainSrc = list[selectedIndex] ?? list[0];
  const hasMultiple = list.length > 1;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || list.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Main image with hover zoom */}
      <div
        ref={containerRef}
        className="relative aspect-square overflow-hidden rounded-lg bg-muted"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setZoomOpen(false)}
        onMouseEnter={() => setZoomOpen(true)}
        onClick={() => hasMultiple && setZoomOpen((v) => !v)}
      >
        <Image
          alt={productName}
          className={cn(
            "object-cover transition-transform duration-150",
            zoomOpen && "cursor-zoom-out scale-150",
          )}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          src={mainSrc}
          style={
            zoomOpen
              ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
              : undefined
          }
        />
        {discountPercentage > 0 && (
          <div className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
            -{discountPercentage}%
          </div>
        )}
      </div>

      {/* Thumbnails when multiple images */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedIndex(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                selectedIndex === i
                  ? "border-primary"
                  : "border-transparent hover:border-muted-foreground/50",
              )}
              aria-label={`View image ${i + 1} of ${list.length}`}
            >
              <Image
                alt=""
                className="object-cover"
                fill
                sizes="64px"
                src={src}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
