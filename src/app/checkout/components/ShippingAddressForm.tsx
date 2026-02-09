"use client";

import { CircleHelp, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Checkbox } from "~/ui/primitives/checkbox";
import { Input } from "~/ui/primitives/input";
import { Button } from "~/ui/primitives/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { useLoqateAutocomplete } from "~/hooks/use-loqate-autocomplete";
import type { MappedShippingAddress } from "~/lib/loqate";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { cn } from "~/lib/cn";
import {
  type CheckoutFormState,
  COUNTRIES_REQUIRING_STATE,
  COUNTRIES_WITHOUT_POSTAL,
  defaultForm,
  checkoutFieldHeight,
  selectInputClass,
  getPersistedShippingForm,
  persistShippingForm,
  US_STATE_OPTIONS,
} from "../checkout-shared";

const SHIPPING_CALCULATE_TIMEOUT_MS = 15_000;

export interface ShippingUpdate {
  shippingCents: number;
  shippingLabel: string | null;
  shippingFree: boolean;
  shippingLoading: boolean;
  canShipToCountry: boolean;
  shippingSpeed: "standard" | "express";
  taxCents: number;
  taxNote: string | null;
  customsDutiesNote: string | null;
}

export interface ShippingAddressFormProps {
  countryOptions: { value: string; label: string }[];
  items: { productId?: string; id: string; productVariantId?: string; quantity: number }[];
  subtotal: number;
  appliedCoupon: { code: string; freeShipping: boolean } | null;
  selectedCountry: string | null;
  user: { email?: string; firstName?: string; lastName?: string } | null | undefined;
  isLoggedIn: boolean;
  userReceiveMarketing: boolean;
  userReceiveSmsMarketing: boolean;
  authPending: boolean;
  validationErrors: string[];
  onShippingUpdate: (update: ShippingUpdate) => void;
}

export interface ShippingAddressFormRef {
  getForm: () => CheckoutFormState;
  getEmailNews: () => boolean;
  getTextNews: () => boolean;
  validate: () => string[];
  persistForm: () => void;
}

function validateShippingForm(
  form: CheckoutFormState,
  shippingSpeed: "standard" | "express",
): string[] {
  const err: string[] = [];
  const country = form.country?.trim();
  if (!country) err.push("Country is required");
  if (!form.firstName?.trim()) err.push("First name is required");
  if (!form.lastName?.trim()) err.push("Last name is required");
  if (!form.street?.trim()) err.push("Address is required");
  if (!form.city?.trim()) err.push("City is required");
  if (
    country &&
    !COUNTRIES_WITHOUT_POSTAL.has(country) &&
    !form.zip?.trim()
  ) {
    err.push(
      country === "US" ? "ZIP code is required" : "Postal code is required",
    );
  }
  if (
    country &&
    COUNTRIES_REQUIRING_STATE.has(country) &&
    !form.state?.trim()
  ) {
    err.push(
      country === "US" ? "State is required" : "State / Province is required",
    );
  }
  if (shippingSpeed === "express" && !form.phone?.trim()) {
    err.push("Phone number is required for Express shipping");
  }
  return err;
}

export const ShippingAddressForm = forwardRef<
  ShippingAddressFormRef,
  ShippingAddressFormProps
>(function ShippingAddressForm(
  {
    countryOptions,
    items,
    subtotal,
    appliedCoupon,
    selectedCountry,
    user,
    isLoggedIn,
    userReceiveMarketing,
    userReceiveSmsMarketing,
    authPending,
    validationErrors,
    onShippingUpdate,
  },
  ref,
) {
  const [form, setForm] = useState<CheckoutFormState>(() =>
    getPersistedShippingForm(),
  );
  const [emailNews, setEmailNews] = useState(true);
  const [textNews, setTextNews] = useState(false);
  const [shippingCents, setShippingCents] = useState<number>(0);
  const [shippingLabel, setShippingLabel] = useState<string | null>(null);
  const [shippingFree, setShippingFree] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingSpeed, setShippingSpeed] = useState<"standard" | "express">(
    "standard",
  );
  const [canShipToCountry, setCanShipToCountry] = useState(true);
  const [taxCents, setTaxCents] = useState<number>(0);
  const [taxNote, setTaxNote] = useState<string | null>(null);
  const [customsDutiesNote, setCustomsDutiesNote] = useState<string | null>(
    null,
  );

  const update = useCallback((field: keyof CheckoutFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const onLoqateSelect = useCallback((mapped: MappedShippingAddress) => {
    setForm((prev) => ({
      ...prev,
      street: mapped.street,
      apartment: mapped.apartment || prev.apartment,
      city: mapped.city,
      state: mapped.state,
      zip: mapped.zip,
      country: mapped.country || prev.country,
    }));
  }, []);

  const shippingLoqate = useLoqateAutocomplete({
    text: form.street ?? "",
    country: form.country,
    onSelect: onLoqateSelect,
  });

  const restoreShippingForm = useCallback(() => {
    setForm(getPersistedShippingForm());
  }, []);

  useLayoutEffect(() => {
    restoreShippingForm();
  }, [restoreShippingForm]);

  useEffect(() => {
    window.addEventListener("pageshow", restoreShippingForm);
    const onVisible = () => restoreShippingForm();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pageshow", restoreShippingForm);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [restoreShippingForm]);

  useEffect(() => {
    if (
      !selectedCountry ||
      form.country?.trim() ||
      isShippingExcluded(selectedCountry)
    )
      return;
    setForm((prev) => ({ ...prev, country: selectedCountry }));
  }, [selectedCountry, form.country]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname ?? "";
    const fromTelegram =
      params.get("source") === "telegram" || pathname.startsWith("/telegram");
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!fromTelegram || !tgUser) return;
    const syntheticEmail = `telegram_${tgUser.id}@telegram.user`;
    setForm((prev) =>
      !prev.email?.trim() || prev.email === syntheticEmail
        ? { ...prev, email: syntheticEmail }
        : prev,
    );
  }, []);

  useEffect(() => {
    const u = user;
    if (!u) return;
    const updates: Partial<CheckoutFormState> = {};
    if (u.email && !form.email) updates.email = u.email;
    if (u.firstName && !form.firstName) updates.firstName = u.firstName;
    if (u.lastName && !form.lastName) updates.lastName = u.lastName;
    if (Object.keys(updates).length > 0) {
      setForm((prev) => ({ ...prev, ...updates }));
    }
  }, [user, form.email, form.firstName, form.lastName]);

  useEffect(() => {
    persistShippingForm(form);
  }, [form]);

  useEffect(() => {
    const country = form.country?.trim();
    if (!country || items.length === 0) {
      setShippingCents(0);
      setShippingLabel(null);
      setShippingFree(false);
      setShippingLoading(false);
      setCanShipToCountry(true);
      onShippingUpdate({
        shippingCents: 0,
        shippingLabel: null,
        shippingFree: false,
        shippingLoading: false,
        canShipToCountry: true,
        shippingSpeed: "standard",
        taxCents: 0,
        taxNote: null,
        customsDutiesNote: null,
      });
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    const timeoutId = setTimeout(
      () => ac.abort(),
      SHIPPING_CALCULATE_TIMEOUT_MS,
    );
    setShippingLoading(true);
    onShippingUpdate({
      shippingCents: 0,
      shippingLabel: null,
      shippingFree: false,
      shippingLoading: true,
      canShipToCountry: true,
      shippingSpeed: "standard",
      taxCents: 0,
      taxNote: null,
      customsDutiesNote: null,
    });
    fetch("/api/shipping/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryCode: country,
        orderValueCents: Math.round(subtotal * 100),
        items: items.map((i) => ({
          productId: i.productId ?? i.id,
          productVariantId: i.productVariantId,
          quantity: i.quantity,
        })),
        stateCode: form.state?.trim() || undefined,
        city: form.city?.trim() || undefined,
        zip: form.zip?.trim() || undefined,
        address1: form.street?.trim() || undefined,
        ...(appliedCoupon?.freeShipping && appliedCoupon?.code
          ? { couponCode: appliedCoupon.code }
          : {}),
      }),
      signal: ac.signal,
    })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to calculate")),
      )
      .then(
        (data: {
          shippingCents?: number;
          label?: string | null;
          freeShipping?: boolean;
          canShipToCountry?: boolean;
          shippingSpeed?: "standard" | "express";
          customsDutiesNote?: string | null;
          taxCents?: number;
          taxNote?: string | null;
        }) => {
          if (!cancelled) {
            const cents =
              typeof data.shippingCents === "number" ? data.shippingCents : 0;
            const label = data.label ?? null;
            const free = Boolean(data.freeShipping);
            const canShip = data.canShipToCountry !== false;
            const speed =
              data.shippingSpeed === "express" ? "express" : "standard";
            const tax = typeof data.taxCents === "number" ? data.taxCents : 0;
            const taxN = data.taxNote ?? null;
            const customs = data.customsDutiesNote ?? null;
            setShippingCents(cents);
            setShippingLabel(label);
            setShippingFree(free);
            setCanShipToCountry(canShip);
            setShippingSpeed(speed);
            setTaxCents(tax);
            setTaxNote(taxN);
            setCustomsDutiesNote(customs);
            onShippingUpdate({
              shippingCents: cents,
              shippingLabel: label,
              shippingFree: free,
              shippingLoading: false,
              canShipToCountry: canShip,
              shippingSpeed: speed,
              taxCents: tax,
              taxNote: taxN,
              customsDutiesNote: customs,
            });
          }
        },
      )
      .catch(() => {
        if (!cancelled) {
          setShippingCents(0);
          setShippingLabel(null);
          setShippingFree(false);
          setCanShipToCountry(true);
          setShippingSpeed("standard");
          setTaxCents(0);
          setTaxNote(null);
          setCustomsDutiesNote(null);
          onShippingUpdate({
            shippingCents: 0,
            shippingLabel: null,
            shippingFree: false,
            shippingLoading: false,
            canShipToCountry: true,
            shippingSpeed: "standard",
            taxCents: 0,
            taxNote: null,
            customsDutiesNote: null,
          });
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setShippingLoading(false);
      });
    return () => {
      cancelled = true;
      ac.abort();
      clearTimeout(timeoutId);
    };
  }, [
    form.country,
    form.state,
    form.city,
    form.zip,
    form.street,
    items,
    subtotal,
    appliedCoupon?.code,
    appliedCoupon?.freeShipping,
    onShippingUpdate,
  ]);

  const validate = useCallback(() => {
    return validateShippingForm(form, shippingSpeed);
  }, [form, shippingSpeed]);

  useImperativeHandle(
    ref,
    () => ({
      getForm: () => form,
      getEmailNews: () => emailNews,
      getTextNews: () => textNews,
      validate,
      persistForm: () => persistShippingForm(form),
    }),
    [form, emailNews, textNews, validate],
  );

  const isUS = form.country === "US";

  return (
    <>
      {/* Contact */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Contact</CardTitle>
          {!isLoggedIn && (
            <Link
              className="text-sm font-medium text-primary hover:underline"
              href="/login"
            >
              Sign in
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoggedIn ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Email:</span>{" "}
              {user?.email}
            </p>
          ) : (
            <>
              <Input
                aria-label="Email"
                className={checkoutFieldHeight}
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
              {!(isLoggedIn && userReceiveMarketing) && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={emailNews}
                    onCheckedChange={(v) => setEmailNews(v === true)}
                  />
                  <span>Email me with news and offers</span>
                </label>
              )}
              {!authPending && (
                <div className="flex items-center gap-2">
                  <Button
                    className="text-sm"
                    size="sm"
                    type="button"
                    variant="outline"
                    asChild
                  >
                    <Link
                      href={`/signup?email=${encodeURIComponent(form.email || "")}`}
                    >
                      Save and create account
                    </Link>
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Optional — create an account to track orders.
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Shipping address */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Shipping address</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <select
              aria-label="Country"
              aria-invalid={
                validationErrors.includes("Country is required") ||
                !canShipToCountry
              }
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              className={cn(
                selectInputClass,
                (validationErrors.includes("Country is required") ||
                  !canShipToCountry) &&
                  "border-destructive",
              )}
            >
              {countryOptions.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!canShipToCountry && form.country?.trim() && (
              <p className="mt-1.5 text-sm text-destructive" role="alert">
                We do not ship to this country.
              </p>
            )}
          </div>
          <div>
            <Input
              aria-label="First name"
              aria-invalid={validationErrors.includes("First name is required")}
              className={cn(
                checkoutFieldHeight,
                validationErrors.includes("First name is required") &&
                  "border-destructive",
              )}
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </div>
          <div>
            <Input
              aria-label="Last name"
              aria-invalid={validationErrors.includes("Last name is required")}
              className={cn(
                checkoutFieldHeight,
                validationErrors.includes("Last name is required") &&
                  "border-destructive",
              )}
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              aria-label="Company (optional)"
              className={checkoutFieldHeight}
              placeholder="Company (optional)"
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
            />
          </div>
          <div
            className="relative sm:col-span-2"
            ref={shippingLoqate.containerRef}
          >
            <Input
              aria-label="Address"
              aria-autocomplete="list"
              aria-expanded={shippingLoqate.open}
              aria-invalid={validationErrors.includes("Address is required")}
              className={cn(
                checkoutFieldHeight,
                validationErrors.includes("Address is required") &&
                  "border-destructive",
              )}
              placeholder="Address"
              value={form.street}
              onChange={(e) => update("street", e.target.value)}
              onFocus={() => {
                shippingLoqate.inputFocusedRef.current = true;
                if (shippingLoqate.suggestions.length > 0)
                  shippingLoqate.setOpen(true);
              }}
              onBlur={() => {
                shippingLoqate.inputFocusedRef.current = false;
                setTimeout(() => {
                  if (
                    !shippingLoqate.containerRef.current?.contains(
                      document.activeElement,
                    )
                  ) {
                    shippingLoqate.setOpen(false);
                  }
                }, 200);
              }}
            />
            {shippingLoqate.open &&
              (shippingLoqate.suggestions.length > 0 ||
                shippingLoqate.loading) && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg"
                  role="listbox"
                >
                  {shippingLoqate.loading &&
                  shippingLoqate.suggestions.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2
                        className="h-4 w-4 animate-spin shrink-0"
                        aria-hidden
                      />
                      Finding addresses…
                    </div>
                  ) : (
                    shippingLoqate.suggestions
                      .filter((item) => item.Type === "Address")
                      .map((item) => (
                        <button
                          key={item.Id}
                          type="button"
                          className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                          role="option"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            shippingLoqate.selectAddress(item.Id);
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
              value={form.apartment}
              onChange={(e) => update("apartment", e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
            <div>
              <Input
                aria-label="City"
                aria-invalid={validationErrors.includes("City is required")}
                className={cn(
                  checkoutFieldHeight,
                  validationErrors.includes("City is required") &&
                    "border-destructive",
                )}
                placeholder="City"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            {isUS ? (
              <div>
                <select
                  aria-label="State"
                  aria-invalid={validationErrors.includes("State is required")}
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                  className={cn(
                    selectInputClass,
                    validationErrors.includes("State is required") &&
                      "border-destructive",
                  )}
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
                  aria-label="State / Province"
                  aria-invalid={validationErrors.includes(
                    "State / Province is required",
                  )}
                  className={cn(
                    checkoutFieldHeight,
                    validationErrors.includes(
                      "State / Province is required",
                    ) && "border-destructive",
                  )}
                  placeholder="State / Province"
                  value={form.state}
                  onChange={(e) => update("state", e.target.value)}
                />
              </div>
            )}
            <div>
              <Input
                aria-label={isUS ? "ZIP code" : "Postal code"}
                aria-invalid={
                  validationErrors.includes("ZIP code is required") ||
                  validationErrors.includes("Postal code is required")
                }
                className={cn(
                  checkoutFieldHeight,
                  (validationErrors.includes("ZIP code is required") ||
                    validationErrors.includes("Postal code is required")) &&
                    "border-destructive",
                )}
                placeholder={isUS ? "ZIP code" : "Postal code"}
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Input
              aria-label={
                shippingSpeed === "express"
                  ? "Phone (required)"
                  : "Phone"
              }
              aria-required={shippingSpeed === "express"}
              className={cn(checkoutFieldHeight, "min-w-0 flex-1")}
              placeholder={
                shippingSpeed === "express"
                  ? "Phone"
                  : "Phone (optional)"
              }
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
            <Popover>
              <PopoverTrigger
                type="button"
                className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Why we ask for phone"
              >
                <CircleHelp className="size-5" aria-hidden />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="max-w-56 border-0 bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
                side="top"
              >
                In case we need to contact you about your order
              </PopoverContent>
            </Popover>
          </div>
          {!(isLoggedIn && userReceiveSmsMarketing) && (
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={textNews}
                  onCheckedChange={(v) => setTextNews(v === true)}
                />
                <span>Text me with news and offers</span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping method */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Shipping method</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm font-medium">
              {shippingLoading
                ? "Calculating…"
                : shippingLabel ?? "Shipping"}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {shippingLoading ? (
                "…"
              ) : shippingFree ? (
                "Free"
              ) : (
                <FiatPrice usdAmount={shippingCents / 100} />
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
});
