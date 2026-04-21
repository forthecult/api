"use client";

import * as React from "react";

export interface ProductShippingEstimateContextValue {
  availableCountryCodes?: string[];
  productId: string;
  setSelection: (variantId: null | string) => void;
  variantId: null | string;
}

const ProductShippingEstimateContext =
  React.createContext<null | ProductShippingEstimateContextValue>(null);

export function ProductShippingEstimateProvider({
  availableCountryCodes,
  children,
  productId,
}: {
  availableCountryCodes?: string[];
  children: React.ReactNode;
  productId: string;
}) {
  const [variantId, setVariantId] = React.useState<null | string>(null);

  const setSelection = React.useCallback((id: null | string) => {
    setVariantId(id);
  }, []);

  const value = React.useMemo(
    () => ({
      availableCountryCodes,
      productId,
      setSelection,
      variantId,
    }),
    [availableCountryCodes, productId, setSelection, variantId],
  );

  return (
    <ProductShippingEstimateContext.Provider value={value}>
      {children}
    </ProductShippingEstimateContext.Provider>
  );
}

export function useProductShippingEstimateContext(): null | ProductShippingEstimateContextValue {
  return React.useContext(ProductShippingEstimateContext);
}
