"use client";

import * as React from "react";

export type SelectedVariantForImage = null | {
  id: string;
  imageUrl?: string;
};

const ProductVariantImageContext = React.createContext<{
  selectedVariant: SelectedVariantForImage;
  setSelectedVariant: (v: SelectedVariantForImage) => void;
}>({
  selectedVariant: null,
  setSelectedVariant: () => {},
});

export function ProductVariantImageProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedVariant, setSelectedVariant] =
    React.useState<SelectedVariantForImage>(null);
  const value = React.useMemo(
    () => ({ selectedVariant, setSelectedVariant }),
    [selectedVariant],
  );
  return (
    <ProductVariantImageContext value={value}>
      {children}
    </ProductVariantImageContext>
  );
}

export function useProductVariantImage() {
  return React.use(ProductVariantImageContext);
}
