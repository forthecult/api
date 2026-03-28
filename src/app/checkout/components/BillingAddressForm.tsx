"use client";

import { Loader2 } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import type { MappedShippingAddress } from "~/lib/loqate";

import { useLoqateAutocomplete } from "~/hooks/use-loqate-autocomplete";
import { cn } from "~/lib/cn";
import { Checkbox } from "~/ui/primitives/checkbox";
import { Input } from "~/ui/primitives/input";

import type { ShippingAddressFormRef } from "./ShippingAddressForm";

import {
  type BillingFormState,
  checkoutFieldHeight,
  defaultBillingForm,
  selectInputClass,
  US_STATE_OPTIONS,
} from "../checkout-shared";

export interface BillingAddressFormProps {
  countryOptions: { label: string; value: string }[];
  /** Used to default billing country to shipping country when unchecking "use shipping as billing". */
  shippingFormRef?: React.RefObject<null | ShippingAddressFormRef>;
  validationErrors: string[];
}

export interface BillingAddressFormRef {
  getBilling: () => BillingFormState | null;
  getUseShippingAsBilling: () => boolean;
  validate: () => string[];
}

function validateBillingForm(form: BillingFormState): string[] {
  const err: string[] = [];
  if (!form.country?.trim()) err.push("Billing country is required");
  if (!form.firstName?.trim()) err.push("Billing first name is required");
  if (!form.lastName?.trim()) err.push("Billing last name is required");
  if (!form.street?.trim()) err.push("Billing address is required");
  return err;
}

export const BillingAddressForm = function BillingAddressForm({
  countryOptions,
  ref,
  shippingFormRef,
  validationErrors,
}: BillingAddressFormProps & {
  ref?: React.RefObject<BillingAddressFormRef | null>;
}) {
  const [useShippingAsBilling, setUseShippingAsBilling] = useState(true);
  const [billingForm, setBillingForm] =
    useState<BillingFormState>(defaultBillingForm);

  const updateBilling = useCallback(
    (field: keyof BillingFormState, value: string) => {
      setBillingForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const onLoqateSelect = useCallback((mapped: MappedShippingAddress) => {
    setBillingForm((prev) => ({
      ...prev,
      apartment: mapped.apartment || prev.apartment,
      city: mapped.city,
      country: mapped.country || prev.country,
      state: mapped.state,
      street: mapped.street,
      zip: mapped.zip,
    }));
  }, []);

  const billingLoqate = useLoqateAutocomplete({
    country: billingForm.country,
    enabled: !useShippingAsBilling,
    onSelect: onLoqateSelect,
    text: billingForm.street ?? "",
  });

  const validate = useCallback((): string[] => {
    if (useShippingAsBilling) return [];
    return validateBillingForm(billingForm);
  }, [useShippingAsBilling, billingForm]);

  useImperativeHandle(
    ref,
    () => ({
      getBilling: () => (useShippingAsBilling ? null : billingForm),
      getUseShippingAsBilling: () => useShippingAsBilling,
      validate,
    }),
    [useShippingAsBilling, billingForm, validate],
  );

  const isBillingUS = billingForm.country === "US";

  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={useShippingAsBilling}
          onCheckedChange={(v) => {
            const checked = v === true;
            setUseShippingAsBilling(checked);
            // Default billing country to shipping country for convenience
            if (!checked) {
              const shippingCountry =
                shippingFormRef?.current?.getForm()?.country;
              if (shippingCountry) {
                setBillingForm((prev) => ({
                  ...prev,
                  country: shippingCountry,
                }));
              }
            }
          }}
        />
        <span>Use shipping address as billing address</span>
      </label>
      {!useShippingAsBilling && (
        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="font-semibold">Billing address</h3>
          <div
            className={`
            grid gap-4
            sm:grid-cols-2
          `}
          >
            <div className="sm:col-span-2">
              <select
                aria-invalid={validationErrors.includes(
                  "Billing country is required",
                )}
                aria-label="Country/Region"
                className={cn(
                  selectInputClass,
                  validationErrors.includes("Billing country is required") &&
                    "border-destructive",
                )}
                onChange={(e) => updateBilling("country", e.target.value)}
                value={billingForm.country}
              >
                {countryOptions.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Input
                aria-invalid={validationErrors.includes(
                  "Billing first name is required",
                )}
                aria-label="First name (billing)"
                className={cn(
                  checkoutFieldHeight,
                  validationErrors.includes("Billing first name is required") &&
                    "border-destructive",
                )}
                onChange={(e) => updateBilling("firstName", e.target.value)}
                placeholder="First name"
                value={billingForm.firstName}
              />
            </div>
            <div>
              <Input
                aria-invalid={validationErrors.includes(
                  "Billing last name is required",
                )}
                aria-label="Last name (billing)"
                className={cn(
                  checkoutFieldHeight,
                  validationErrors.includes("Billing last name is required") &&
                    "border-destructive",
                )}
                onChange={(e) => updateBilling("lastName", e.target.value)}
                placeholder="Last name"
                value={billingForm.lastName}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label="Company (optional)"
                className={checkoutFieldHeight}
                onChange={(e) => updateBilling("company", e.target.value)}
                placeholder="Company (optional)"
                value={billingForm.company}
              />
            </div>
            <div
              className={`
                relative
                sm:col-span-2
              `}
              ref={billingLoqate.containerRef}
            >
              <Input
                aria-autocomplete="list"
                aria-expanded={billingLoqate.open}
                aria-invalid={validationErrors.includes(
                  "Billing address is required",
                )}
                aria-label="Address (billing)"
                className={cn(
                  checkoutFieldHeight,
                  validationErrors.includes("Billing address is required") &&
                    "border-destructive",
                )}
                onBlur={() => {
                  billingLoqate.inputFocusedRef.current = false;
                  setTimeout(() => {
                    if (
                      !billingLoqate.containerRef.current?.contains(
                        document.activeElement,
                      )
                    ) {
                      billingLoqate.setOpen(false);
                    }
                  }, 200);
                }}
                onChange={(e) => updateBilling("street", e.target.value)}
                onFocus={() => {
                  billingLoqate.inputFocusedRef.current = true;
                  if (billingLoqate.suggestions.length > 0)
                    billingLoqate.setOpen(true);
                }}
                placeholder="Address"
                value={billingForm.street}
              />
              {billingLoqate.open &&
                (billingLoqate.suggestions.length > 0 ||
                  billingLoqate.loading) && (
                  <div
                    className={`
                      absolute top-full right-0 left-0 z-50 mt-1 max-h-60
                      overflow-auto rounded-md border border-border
 bg-background 
                    `}
                    role="listbox"
                  >
                    {billingLoqate.loading &&
                    billingLoqate.suggestions.length === 0 ? (
                      <div
                        className={`
                        flex items-center gap-2 px-3 py-2 text-sm
                        text-muted-foreground
                      `}
                      >
                        <Loader2
                          aria-hidden
                          className="h-4 w-4 shrink-0 animate-spin"
                        />
                        Finding addresses…
                      </div>
                    ) : (
                      billingLoqate.suggestions
                        .filter((item) => item.Type === "Address")
                        .map((item) => (
                          <button
                            className={`
                              w-full cursor-pointer px-3 py-2 text-left text-sm
                              hover:bg-muted
                              focus:bg-muted focus:outline-none
                            `}
                            key={item.Id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              billingLoqate.selectAddress(item.Id);
                            }}
                            role="option"
                            type="button"
                          >
                            <span className="font-medium">{item.Text}</span>
                            {item.Description ? (
                              <span className="ml-1 text-muted-foreground">
                                {item.Description}
                              </span>
                            ) : null}
                          </button>
                        ))
                    )}
                  </div>
                )}
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label="Apartment, suite, etc (optional)"
                className={checkoutFieldHeight}
                onChange={(e) => updateBilling("apartment", e.target.value)}
                placeholder="Apartment, suite, etc (optional)"
                value={billingForm.apartment}
              />
            </div>
            <div
              className={`
              grid gap-4
              sm:col-span-2 sm:grid-cols-3
            `}
            >
              <div>
                <Input
                  aria-label="City (billing)"
                  className={checkoutFieldHeight}
                  onChange={(e) => updateBilling("city", e.target.value)}
                  placeholder="City"
                  value={billingForm.city}
                />
              </div>
              {isBillingUS ? (
                <div>
                  <select
                    aria-label="State (billing)"
                    className={selectInputClass}
                    onChange={(e) => updateBilling("state", e.target.value)}
                    value={billingForm.state}
                  >
                    {US_STATE_OPTIONS.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <Input
                    aria-label="State / Province (billing)"
                    className={checkoutFieldHeight}
                    onChange={(e) => updateBilling("state", e.target.value)}
                    placeholder="State / Province"
                    value={billingForm.state}
                  />
                </div>
              )}
              <div>
                <Input
                  aria-label={
                    isBillingUS ? "Zip code (billing)" : "Postal code (billing)"
                  }
                  className={checkoutFieldHeight}
                  onChange={(e) => updateBilling("zip", e.target.value)}
                  placeholder={isBillingUS ? "Zip code" : "Postal code"}
                  value={billingForm.zip}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label="Phone (optional)"
                className={checkoutFieldHeight}
                onChange={(e) => updateBilling("phone", e.target.value)}
                placeholder="Phone (optional)"
                type="tel"
                value={billingForm.phone}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
