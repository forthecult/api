"use client";

import { Loader2 } from "lucide-react";
import {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import { Checkbox } from "~/ui/primitives/checkbox";
import { Input } from "~/ui/primitives/input";
import { useLoqateAutocomplete } from "~/hooks/use-loqate-autocomplete";
import type { MappedShippingAddress } from "~/lib/loqate";
import { cn } from "~/lib/cn";
import {
  type BillingFormState,
  defaultBillingForm,
  checkoutFieldHeight,
  selectInputClass,
  US_STATE_OPTIONS,
} from "../checkout-shared";

export interface BillingAddressFormProps {
  countryOptions: { value: string; label: string }[];
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

export const BillingAddressForm = forwardRef<
  BillingAddressFormRef,
  BillingAddressFormProps
>(function BillingAddressForm({ countryOptions, validationErrors }, ref) {
  const [useShippingAsBilling, setUseShippingAsBilling] = useState(true);
  const [billingForm, setBillingForm] =
    useState<BillingFormState>(defaultBillingForm);

  const updateBilling = useCallback((field: keyof BillingFormState, value: string) => {
    setBillingForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const onLoqateSelect = useCallback((mapped: MappedShippingAddress) => {
    setBillingForm((prev) => ({
      ...prev,
      street: mapped.street,
      apartment: mapped.apartment || prev.apartment,
      city: mapped.city,
      state: mapped.state,
      zip: mapped.zip,
      country: mapped.country || prev.country,
    }));
  }, []);

  const billingLoqate = useLoqateAutocomplete({
    text: billingForm.street ?? "",
    country: billingForm.country,
    enabled: !useShippingAsBilling,
    onSelect: onLoqateSelect,
  });

  const validate = useCallback((): string[] => {
    if (useShippingAsBilling) return [];
    return validateBillingForm(billingForm);
  }, [useShippingAsBilling, billingForm]);

  useImperativeHandle(
    ref,
    () => ({
      getBilling: () =>
        useShippingAsBilling ? null : billingForm,
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
          onCheckedChange={(v) => setUseShippingAsBilling(v === true)}
        />
        <span>Use shipping address as billing address</span>
      </label>
      {!useShippingAsBilling && (
        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="font-semibold">Billing address</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <select
                aria-label="Country/Region"
                aria-invalid={validationErrors.includes(
                  "Billing country is required",
                )}
                value={billingForm.country}
                onChange={(e) => updateBilling("country", e.target.value)}
                className={cn(
                  selectInputClass,
                  validationErrors.includes(
                    "Billing country is required",
                  ) && "border-destructive",
                )}
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
                aria-label="First name (billing)"
                aria-invalid={validationErrors.includes(
                  "Billing first name is required",
                )}
                className={cn(
                  checkoutFieldHeight,
                  validationErrors.includes(
                    "Billing first name is required",
                  ) && "border-destructive",
                )}
                placeholder="First name"
                value={billingForm.firstName}
                onChange={(e) =>
                  updateBilling("firstName", e.target.value)
                }
              />
            </div>
            <div>
              <Input
                aria-label="Last name (billing)"
                aria-invalid={validationErrors.includes(
                  "Billing last name is required",
                )}
                className={cn(
                  checkoutFieldHeight,
                  validationErrors.includes(
                    "Billing last name is required",
                  ) && "border-destructive",
                )}
                placeholder="Last name"
                value={billingForm.lastName}
                onChange={(e) =>
                  updateBilling("lastName", e.target.value)
                }
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label="Company (optional)"
                className={checkoutFieldHeight}
                placeholder="Company (optional)"
                value={billingForm.company}
                onChange={(e) =>
                  updateBilling("company", e.target.value)
                }
              />
            </div>
            <div
              className="relative sm:col-span-2"
              ref={billingLoqate.containerRef}
            >
              <Input
                aria-label="Address (billing)"
                aria-autocomplete="list"
                aria-expanded={billingLoqate.open}
                aria-invalid={validationErrors.includes(
                  "Billing address is required",
                )}
                className={cn(
                  checkoutFieldHeight,
                  validationErrors.includes(
                    "Billing address is required",
                  ) && "border-destructive",
                )}
                placeholder="Address"
                value={billingForm.street}
                onChange={(e) =>
                  updateBilling("street", e.target.value)
                }
                onFocus={() => {
                  billingLoqate.inputFocusedRef.current = true;
                  if (billingLoqate.suggestions.length > 0)
                    billingLoqate.setOpen(true);
                }}
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
              />
              {billingLoqate.open &&
                (billingLoqate.suggestions.length > 0 ||
                  billingLoqate.loading) && (
                  <div
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg"
                    role="listbox"
                  >
                    {billingLoqate.loading &&
                    billingLoqate.suggestions.length === 0 ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2
                          className="h-4 w-4 animate-spin shrink-0"
                          aria-hidden
                        />
                        Finding addresses…
                      </div>
                    ) : (
                      billingLoqate.suggestions
                        .filter((item) => item.Type === "Address")
                        .map((item) => (
                          <button
                            key={item.Id}
                            type="button"
                            className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                            role="option"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              billingLoqate.selectAddress(item.Id);
                            }}
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
                placeholder="Apartment, suite, etc (optional)"
                value={billingForm.apartment}
                onChange={(e) =>
                  updateBilling("apartment", e.target.value)
                }
              />
            </div>
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
              <div>
                <Input
                  aria-label="City (billing)"
                  className={checkoutFieldHeight}
                  placeholder="City"
                  value={billingForm.city}
                  onChange={(e) =>
                    updateBilling("city", e.target.value)
                  }
                />
              </div>
              {isBillingUS ? (
                <div>
                  <select
                    aria-label="State (billing)"
                    value={billingForm.state}
                    onChange={(e) =>
                      updateBilling("state", e.target.value)
                    }
                    className={selectInputClass}
                  >
                    {US_STATE_OPTIONS.map((opt) => (
                      <option
                        key={opt.value || "empty"}
                        value={opt.value}
                      >
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
                    placeholder="State / Province"
                    value={billingForm.state}
                    onChange={(e) =>
                      updateBilling("state", e.target.value)
                    }
                  />
                </div>
              )}
              <div>
                <Input
                  aria-label={
                    isBillingUS
                      ? "Zip code (billing)"
                      : "Postal code (billing)"
                  }
                  className={checkoutFieldHeight}
                  placeholder={
                    isBillingUS ? "Zip code" : "Postal code"
                  }
                  value={billingForm.zip}
                  onChange={(e) =>
                    updateBilling("zip", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Input
                aria-label="Phone (optional)"
                className={checkoutFieldHeight}
                placeholder="Phone (optional)"
                type="tel"
                value={billingForm.phone}
                onChange={(e) =>
                  updateBilling("phone", e.target.value)
                }
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});
