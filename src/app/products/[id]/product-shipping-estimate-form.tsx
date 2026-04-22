"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import {
  COUNTRIES_REQUIRING_STATE,
  COUNTRIES_WITHOUT_POSTAL,
  US_STATE_OPTIONS,
} from "~/app/checkout/checkout-shared";
import { cn } from "~/lib/cn";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

import { useProductShippingEstimateContext } from "./product-shipping-estimate-context";

export interface ProductShippingEstimateFormProps {
  availableCountryCodes?: string[];
  productId: string;
}

const SELECT_CLASS = cn(
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
  `
    text-foreground
    focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none
  `,
);

interface EstimateOption {
  deliveryHint: null | string;
  label: string;
  shippingCents: number;
  shippingSpeed: "express" | "standard";
}

export function ProductShippingEstimateForm({
  availableCountryCodes: availableCountryCodesProp,
  productId: productIdProp,
}: ProductShippingEstimateFormProps) {
  const ctx = useProductShippingEstimateContext();
  const productId = ctx?.productId ?? productIdProp;
  const availableCountryCodes =
    ctx?.availableCountryCodes ?? availableCountryCodesProp;
  const { selectedCountry: preferredCountry } = useCountryCurrency();
  const [country, setCountry] = React.useState("");
  const [postal, setPostal] = React.useState("");
  const [stateCode, setStateCode] = React.useState("");
  const [options, setOptions] = React.useState<EstimateOption[]>([]);
  const [canShip, setCanShip] = React.useState(true);
  const [unavailable, setUnavailable] = React.useState(false);
  const [fulfillmentError, setFulfillmentError] = React.useState<null | string>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const countryOptions = React.useMemo(() => {
    const rows = COUNTRY_OPTIONS_ALPHABETICAL.map((o) => ({
      code: o.code,
      label: o.countryName,
    })).sort((a, b) => a.label.localeCompare(b.label));
    const allowed = availableCountryCodes?.filter(Boolean) ?? [];
    if (allowed.length === 0) return rows;
    const upper = new Set(
      allowed.map((c) => c.trim().toUpperCase().slice(0, 2)),
    );
    const filtered = rows.filter((r) => upper.has(r.code));
    if (filtered.length > 0) return filtered;
    return allowed.map((c) => {
      const code = c.trim().toUpperCase().slice(0, 2);
      const known = rows.find((r) => r.code === code);
      return { code, label: known?.label ?? code };
    });
  }, [availableCountryCodes]);

  React.useEffect(() => {
    if (country) return;
    const pref = preferredCountry?.trim().toUpperCase().slice(0, 2);
    if (pref && countryOptions.some((o) => o.code === pref)) {
      setCountry(pref);
      return;
    }
    const first = countryOptions[0]?.code;
    if (first) setCountry(first);
  }, [country, countryOptions, preferredCountry]);

  const needsState = country ? COUNTRIES_REQUIRING_STATE.has(country) : false;
  const needsPostal = country ? !COUNTRIES_WITHOUT_POSTAL.has(country) : true;
  const excluded =
    country.length === 2 && isShippingExcluded(country.toUpperCase());

  const canSubmit =
    Boolean(productId) &&
    country.length === 2 &&
    !excluded &&
    (!needsState || stateCode.trim().length > 0) &&
    (!needsPostal || postal.trim().length > 0);

  const runEstimate = React.useCallback(async () => {
    if (!productId || !canSubmit) return;
    setLoading(true);
    setSubmitted(true);
    setFulfillmentError(null);
    try {
      const res = await fetch("/api/shipping/product-estimate", {
        body: JSON.stringify({
          countryCode: country.toUpperCase(),
          postalCode: needsPostal ? postal.trim() : undefined,
          productId,
          ...(ctx?.variantId && { productVariantId: ctx.variantId }),
          quantity: 1,
          ...(needsState && stateCode.trim()
            ? { stateCode: stateCode.trim() }
            : {}),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json()) as {
        canShipToCountry?: boolean;
        fulfillmentError?: null | string;
        options?: EstimateOption[];
        unavailableProducts?: string[];
      };
      setCanShip(data.canShipToCountry !== false);
      setUnavailable(
        Array.isArray(data.unavailableProducts) &&
          data.unavailableProducts.length > 0,
      );
      setFulfillmentError(
        data.fulfillmentError != null && data.fulfillmentError !== ""
          ? data.fulfillmentError
          : null,
      );
      setOptions(Array.isArray(data.options) ? data.options : []);
    } catch {
      setOptions([]);
      setFulfillmentError("Could not reach the shipping service.");
    } finally {
      setLoading(false);
    }
  }, [
    canSubmit,
    country,
    ctx?.variantId,
    needsPostal,
    needsState,
    postal,
    productId,
    stateCode,
  ]);

  if (!productId) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">
        Estimate shipping
      </h4>
      <p className="text-xs text-muted-foreground">
        Estimates use the same rules as checkout. Final cost may change with
        your full address or promotions.
      </p>
      <div
        className={`
          grid gap-3
          sm:grid-cols-2
        `}
      >
        <div className="sm:col-span-2">
          <Label className="text-xs" htmlFor="ship-est-country">
            Country
          </Label>
          <select
            className={cn(SELECT_CLASS, "mt-1")}
            id="ship-est-country"
            onChange={(e) => {
              setCountry(e.target.value);
              setStateCode("");
              setOptions([]);
              setSubmitted(false);
            }}
            value={country}
          >
            {countryOptions.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {needsState && (
          <div className="sm:col-span-2">
            <Label className="text-xs" htmlFor="ship-est-state">
              State / province
            </Label>
            {country === "US" ? (
              <select
                className={cn(SELECT_CLASS, "mt-1")}
                id="ship-est-state"
                onChange={(e) => {
                  setStateCode(e.target.value);
                  setOptions([]);
                  setSubmitted(false);
                }}
                value={stateCode}
              >
                {US_STATE_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                className="mt-1"
                id="ship-est-state"
                onChange={(e) => {
                  setStateCode(e.target.value);
                  setOptions([]);
                  setSubmitted(false);
                }}
                placeholder="Region code or name"
                value={stateCode}
              />
            )}
          </div>
        )}
        {needsPostal && (
          <div className="sm:col-span-2">
            <Label className="text-xs" htmlFor="ship-est-postal">
              Postal code
            </Label>
            <Input
              className="mt-1"
              id="ship-est-postal"
              onChange={(e) => {
                setPostal(e.target.value);
                setOptions([]);
                setSubmitted(false);
              }}
              value={postal}
            />
          </div>
        )}
      </div>
      {excluded && (
        <p className="text-sm text-destructive" role="status">
          We do not ship to this country.
        </p>
      )}
      <Button
        className={`
          w-full
          sm:w-auto
        `}
        disabled={!canSubmit || loading || excluded}
        onClick={() => void runEstimate()}
        type="button"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Calculating…
          </>
        ) : (
          "Show shipping options"
        )}
      </Button>
      {submitted && !loading && !canShip && (
        <p className="text-sm text-destructive" role="status">
          {unavailable
            ? "This product is not available for shipping to the selected country."
            : "Shipping is not available for this destination."}
        </p>
      )}
      {submitted && !loading && fulfillmentError && options.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          {fulfillmentError}
        </p>
      )}
      {options.length > 0 && (
        <ul
          className={`
            space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm
          `}
        >
          {options.map((o) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-2"
              key={`${o.label}-${o.shippingCents}-${o.shippingSpeed}`}
            >
              <span className="text-foreground">{o.label}</span>
              <span className="font-medium tabular-nums">
                {o.shippingCents === 0 ? (
                  "Free"
                ) : (
                  <FiatPrice usdAmount={o.shippingCents / 100} />
                )}
              </span>
              {o.deliveryHint && (
                <span className="w-full text-xs text-muted-foreground">
                  {o.deliveryHint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
