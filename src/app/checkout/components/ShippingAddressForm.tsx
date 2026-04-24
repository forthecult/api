"use client";

import { ChevronDown, CircleHelp, Eye, EyeOff } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { MappedShippingAddress } from "~/lib/loqate";

import { useLoqateAutocomplete } from "~/hooks/use-loqate-autocomplete";
import { signIn } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { resolveGeoRegionForCheckout } from "~/lib/geo-subdivision";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import { Checkbox } from "~/ui/primitives/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/ui/primitives/dialog";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";
import { Spinner } from "~/ui/primitives/spinner";

import {
  checkoutFieldHeight,
  type CheckoutFormState,
  COUNTRIES_REQUIRING_STATE,
  COUNTRIES_WITHOUT_POSTAL,
  getPersistedShippingForm,
  persistShippingForm,
  selectInputClass,
  US_STATE_OPTIONS,
} from "../checkout-shared";
import { preloadStripe } from "../stripe-preload";

const SHIPPING_CALCULATE_TIMEOUT_MS = 15_000;

export interface ShippingAddressFormProps {
  appliedCoupon: null | { code: string; freeShipping: boolean };
  authPending: boolean;
  countryOptions: { label: string; value: string }[];
  /** When true, only show email field and skip shipping address/method (e.g. digital-only cart). */
  emailOnly?: boolean;
  isLoggedIn: boolean;
  items: {
    digital?: boolean;
    id: string;
    productId?: string;
    productVariantId?: string;
    quantity: number;
  }[];
  onShippingUpdate: (update: ShippingUpdate) => void;
  selectedCountry: null | string;
  subtotal: number;
  user:
    | null
    | undefined
    | { email?: string; firstName?: string; lastName?: string };
  userReceiveMarketing: boolean;
  userReceiveSmsMarketing: boolean;
  validationErrors: string[];
}

export interface ShippingAddressFormRef {
  getEmailNews: () => boolean;
  getForm: () => CheckoutFormState;
  getTextNews: () => boolean;
  persistForm: () => void;
  validate: () => string[];
}

export interface ShippingUpdate {
  canShipToCountry: boolean;
  customsDutiesNote: null | string;
  shippingCents: number;
  shippingFree: boolean;
  shippingLabel: null | string;
  shippingLoading: boolean;
  shippingSpeed: "express" | "standard";
  taxCents: number;
  taxNote: null | string;
}

/** Saved address from GET /api/user/addresses */
interface SavedAddress {
  address1: string;
  address2?: string;
  city: string;
  countryCode: string;
  id: string;
  isDefault: boolean;
  label?: string;
  phone?: string;
  stateCode?: string;
  zip: string;
}

/** Inline sign-in dialog that keeps the user on the checkout page. */
function CheckoutSignInDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result?.error) {
        setError(
          typeof result.error.message === "string"
            ? result.error.message
            : "Invalid email or password",
        );
        setLoading(false);
        return;
      }
      // Reload the page to pick up the new session — keeps user on checkout
      window.location.reload();
    } catch {
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          className={`
            text-sm font-medium text-primary
            hover:underline
          `}
          type="button"
        >
          Sign in
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in to your account</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Sign in to speed up checkout with your saved details.
        </p>
        <form
          className="mt-2 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(e);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="checkout-signin-email">Email</Label>
            <Input
              autoComplete="email"
              disabled={loading}
              id="checkout-signin-email"
              inputMode="email"
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              placeholder="your@email.com"
              required
              type="email"
              value={email}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="checkout-signin-password">Password</Label>
            <div className="relative">
              <Input
                autoComplete="current-password"
                className="pr-9"
                disabled={loading}
                id="checkout-signin-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Password"
                required
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className={`
                  absolute top-1/2 right-2 -translate-y-1/2 rounded p-1
                  text-muted-foreground
                  hover:text-foreground
                `}
                onClick={() => setShowPassword((p) => !p)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? (
              <>
                <Spinner className="mr-1.5 size-3.5" variant="inline" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          No account? No problem — you can check out as a guest.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function validateEmailOnlyForm(form: CheckoutFormState): string[] {
  const err: string[] = [];
  if (!form.email?.trim()) err.push("Email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    err.push("Please enter a valid email address");
  return err;
}

function validateShippingForm(
  form: CheckoutFormState,
  shippingSpeed: "express" | "standard",
): string[] {
  const err: string[] = [];
  const country = form.country?.trim();
  if (!country) err.push("Country is required");
  if (!form.firstName?.trim()) err.push("First name is required");
  if (!form.lastName?.trim()) err.push("Last name is required");
  if (!form.street?.trim()) err.push("Address is required");
  if (!form.city?.trim()) err.push("City is required");
  if (country && !COUNTRIES_WITHOUT_POSTAL.has(country) && !form.zip?.trim()) {
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

export const ShippingAddressForm = function ShippingAddressForm({
  appliedCoupon,
  authPending: _authPending,
  countryOptions,
  emailOnly = false,
  isLoggedIn,
  items,
  onShippingUpdate,
  ref,
  selectedCountry,
  subtotal,
  user,
  userReceiveMarketing: _userReceiveMarketing,
  userReceiveSmsMarketing: _userReceiveSmsMarketing,
  validationErrors,
}: ShippingAddressFormProps & {
  ref?: React.RefObject<null | ShippingAddressFormRef>;
}) {
  const [form, setForm] = useState<CheckoutFormState>(() =>
    getPersistedShippingForm(),
  );
  const [emailNews, _setEmailNews] = useState(true);
  const [textNews, _setTextNews] = useState(false);
  const [showCompany, setShowCompany] = useState(() =>
    Boolean(getPersistedShippingForm().company?.trim()),
  );
  /** Track which fields the user has touched (blurred) for inline validation. */
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const shippingIpRegionPrefillDone = useRef(false);
  /** Saved addresses for logged-in users. */
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  /** Selected saved address id; empty string = manual entry. */
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState("");
  const [savedAddressPopoverOpen, setSavedAddressPopoverOpen] = useState(false);
  /** "Save this address for next time" — persisted to sessionStorage for success page. */
  const [saveAddressForNextTime, setSaveAddressForNextTime] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("checkout_save_address") === "1";
  });
  const markTouched = useCallback((field: string) => {
    setTouchedFields((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }, []);
  /** Local shipping state for rendering the Shipping Method card and
   *  for validating express-shipping phone requirements. All changes
   *  are also pushed to the parent via onShippingUpdate. */
  const [localShipping, setLocalShipping] = useState<ShippingUpdate>({
    canShipToCountry: true,
    customsDutiesNote: null,
    shippingCents: 0,
    shippingFree: false,
    shippingLabel: null,
    shippingLoading: false,
    shippingSpeed: "standard",
    taxCents: 0,
    taxNote: null,
  });

  const update = useCallback(
    (field: keyof CheckoutFormState, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  /** Update local shipping state and push to parent in one call. */
  const updateShipping = useCallback(
    (next: ShippingUpdate) => {
      setLocalShipping(next);
      onShippingUpdate(next);
    },
    [onShippingUpdate],
  );

  const onLoqateSelect = useCallback((mapped: MappedShippingAddress) => {
    setForm((prev) => ({
      ...prev,
      apartment: mapped.apartment || prev.apartment,
      city: mapped.city,
      country: mapped.country || prev.country,
      state: mapped.state,
      street: mapped.street,
      zip: mapped.zip,
    }));
  }, []);

  const applySavedAddress = useCallback((addr: SavedAddress) => {
    setForm((prev) => ({
      ...prev,
      apartment: addr.address2 ?? "",
      city: addr.city,
      country: addr.countryCode,
      phone: addr.phone ?? "",
      state: addr.stateCode ?? "",
      street: addr.address1,
      zip: addr.zip,
    }));
  }, []);

  /** True if current form address matches at least one saved address. */
  const formMatchesSavedAddress = useCallback(() => {
    const s = form.street?.trim();
    const a2 = form.apartment?.trim() ?? "";
    const c = form.city?.trim();
    const st = form.state?.trim() ?? "";
    const co = form.country?.trim();
    const z = form.zip?.trim();
    const p = form.phone?.trim() ?? "";
    return savedAddresses.some(
      (addr) =>
        addr.address1 === s &&
        (addr.address2 ?? "") === a2 &&
        addr.city === c &&
        (addr.stateCode ?? "") === st &&
        addr.countryCode === co &&
        addr.zip === z &&
        (addr.phone ?? "") === p,
    );
  }, [
    form.street,
    form.apartment,
    form.city,
    form.state,
    form.country,
    form.zip,
    form.phone,
    savedAddresses,
  ]);

  const showSaveAddressCheckbox =
    isLoggedIn &&
    savedAddresses.length > 0 &&
    form.street?.trim() &&
    form.city?.trim() &&
    form.country?.trim() &&
    form.zip?.trim() &&
    !formMatchesSavedAddress();

  const handleSaveAddressCheckboxChange = useCallback((checked: boolean) => {
    setSaveAddressForNextTime(checked);
    if (typeof window !== "undefined") {
      if (checked) sessionStorage.setItem("checkout_save_address", "1");
      else sessionStorage.removeItem("checkout_save_address");
    }
  }, []);

  const shippingLoqate = useLoqateAutocomplete({
    country: form.country,
    onSelect: onLoqateSelect,
    text: form.street ?? "",
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

  /** Prefill state / province from IP geo when empty and geo country matches (any ISO country). */
  useEffect(() => {
    if (emailOnly || shippingIpRegionPrefillDone.current) return;
    const c = form.country?.trim().toUpperCase().slice(0, 2);
    if (c.length !== 2) return;
    if (form.state?.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/geo", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          country?: null | string;
          region?: null | string;
          regionName?: null | string;
        };
        if (cancelled) return;
        const gc = data.country?.trim().toUpperCase().slice(0, 2);
        if (gc && gc !== c) return;
        const merged = resolveGeoRegionForCheckout(
          c,
          data.region?.trim() || undefined,
          data.regionName?.trim() || undefined,
        );
        if (!merged) return;
        shippingIpRegionPrefillDone.current = true;
        setForm((prev) => ({ ...prev, state: merged }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [emailOnly, form.country, form.state]);

  /** Fetch saved addresses for logged-in users. */
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    fetch("/api/user/addresses", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { addresses: [] }))
      .then((raw: unknown) => {
        const data = raw as { addresses?: SavedAddress[] };
        if (!cancelled && Array.isArray(data.addresses)) {
          setSavedAddresses(data.addresses);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    persistShippingForm(form);
  }, [form]);

  useEffect(() => {
    const EMPTY_SHIPPING: ShippingUpdate = {
      canShipToCountry: true,
      customsDutiesNote: null,
      shippingCents: 0,
      shippingFree: false,
      shippingLabel: null,
      shippingLoading: false,
      shippingSpeed: "standard",
      taxCents: 0,
      taxNote: null,
    };
    if (emailOnly) {
      updateShipping(EMPTY_SHIPPING);
      return;
    }
    const country = form.country?.trim();
    if (!country || items.length === 0) {
      updateShipping(EMPTY_SHIPPING);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    const timeoutId = setTimeout(
      () => ac.abort(),
      SHIPPING_CALCULATE_TIMEOUT_MS,
    );
    updateShipping({ ...EMPTY_SHIPPING, shippingLoading: true });
    fetch("/api/shipping/calculate", {
      body: JSON.stringify({
        address1: form.street?.trim() || undefined,
        city: form.city?.trim() || undefined,
        countryCode: country,
        items: items.map((i) => ({
          productId: i.productId ?? i.id,
          productVariantId: i.productVariantId,
          quantity: i.quantity,
        })),
        orderValueCents: Math.round(subtotal * 100),
        stateCode: form.state?.trim() || undefined,
        zip: form.zip?.trim() || undefined,
        ...(appliedCoupon?.freeShipping && appliedCoupon?.code
          ? { couponCode: appliedCoupon.code }
          : {}),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: ac.signal,
    })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to calculate")),
      )
      .then((raw: unknown) => {
        const data = raw as {
          canShipToCountry?: boolean;
          customsDutiesNote?: null | string;
          freeShipping?: boolean;
          label?: null | string;
          shippingCents?: number;
          shippingSpeed?: "express" | "standard";
          taxCents?: number;
          taxNote?: null | string;
        };
        if (!cancelled) {
          updateShipping({
            canShipToCountry: data.canShipToCountry !== false,
            customsDutiesNote: data.customsDutiesNote ?? null,
            shippingCents:
              typeof data.shippingCents === "number" ? data.shippingCents : 0,
            shippingFree: Boolean(data.freeShipping),
            shippingLabel: data.label ?? null,
            shippingLoading: false,
            shippingSpeed:
              data.shippingSpeed === "express" ? "express" : "standard",
            taxCents: typeof data.taxCents === "number" ? data.taxCents : 0,
            taxNote: data.taxNote ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) updateShipping(EMPTY_SHIPPING);
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
    return () => {
      cancelled = true;
      ac.abort();
      clearTimeout(timeoutId);
    };
  }, [
    emailOnly,
    form.country,
    form.state,
    form.city,
    form.zip,
    form.street,
    items,
    subtotal,
    appliedCoupon?.code,
    appliedCoupon?.freeShipping,
    updateShipping,
  ]);

  const validate = useCallback(() => {
    if (emailOnly) return validateEmailOnlyForm(form);
    return validateShippingForm(form, localShipping.shippingSpeed);
  }, [emailOnly, form, localShipping.shippingSpeed]);

  useImperativeHandle(
    ref,
    () => ({
      getEmailNews: () => emailNews,
      getForm: () => form,
      getTextNews: () => textNews,
      persistForm: () => persistShippingForm(form),
      validate,
    }),
    [form, emailNews, textNews, validate],
  );

  const {
    canShipToCountry,
    shippingCents,
    shippingFree,
    shippingLabel,
    shippingLoading,
    shippingSpeed,
  } = localShipping;
  const isUS = form.country === "US";

  /** Show field error if field was touched (blurred) OR submit validation ran. */
  const showFieldError = useCallback(
    (errorMsg: string, fieldName: string): boolean => {
      return (
        validationErrors.includes(errorMsg) ||
        (touchedFields.has(fieldName) &&
          validateShippingForm(form, localShipping.shippingSpeed).includes(
            errorMsg,
          ))
      );
    },
    [validationErrors, touchedFields, form, localShipping.shippingSpeed],
  );

  return (
    <>
      {/* Contact */}
      <Card className="shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Contact</CardTitle>
          {!isLoggedIn && <CheckoutSignInDialog />}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoggedIn ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Email:</span>{" "}
              {user?.email}
            </p>
          ) : (
            <>
              <Input
                aria-label="Email"
                autoComplete="email"
                className={cn(
                  checkoutFieldHeight,
                  touchedFields.has("email") &&
                    form.email?.trim() &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
                    "border-destructive",
                )}
                inputMode="email"
                onBlur={() => markTouched("email")}
                onChange={(e) => update("email", e.target.value)}
                onFocus={() => preloadStripe()}
                placeholder="Email"
                type="email"
                value={form.email}
              />
              {touchedFields.has("email") &&
                form.email?.trim() &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    Please enter a valid email address
                  </p>
                )}
              {/* Account creation is handled post-purchase on the success page,
                  keeping checkout focused on completing the transaction. */}
            </>
          )}
        </CardContent>
      </Card>

      {!emailOnly && (
        <>
          {/* Shipping address */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Shipping address</CardTitle>
            </CardHeader>
            <CardContent
              className={`
                grid gap-4
                sm:grid-cols-2
              `}
            >
              {savedAddresses.length > 0 && (
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Use a saved address
                  </Label>
                  <Popover
                    onOpenChange={(open) => {
                      if (open) preloadStripe();
                      setSavedAddressPopoverOpen(open);
                    }}
                    open={savedAddressPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        aria-expanded={savedAddressPopoverOpen}
                        aria-haspopup="listbox"
                        aria-label="Use a saved address"
                        className={cn(
                          selectInputClass,
                          `
                            mt-1.5 flex w-full items-center justify-between
                            gap-2 text-left
                          `,
                        )}
                        type="button"
                      >
                        <span className="truncate">
                          {selectedSavedAddressId
                            ? (() => {
                                const addr = savedAddresses.find(
                                  (a) => a.id === selectedSavedAddressId,
                                );
                                return addr
                                  ? `${addr.label || "Address"} — ${addr.address1}, ${addr.city}${addr.isDefault ? " (Default)" : ""}`
                                  : "Enter address manually";
                              })()
                            : "Enter address manually"}
                        </span>
                        <ChevronDown className="size-4 shrink-0 opacity-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className={`
                        max-h-[min(60vh,320px)]
                        w-[var(--radix-popover-trigger-width)] overflow-auto p-0
                      `}
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <ul aria-label="Use a saved address" className="py-1">
                        <li>
                          <button
                            className={cn(
                              `
                                w-full px-3 py-2 text-left text-sm
                                hover:bg-muted/80
                              `,
                              !selectedSavedAddressId && "bg-muted/50",
                            )}
                            onClick={() => {
                              setSelectedSavedAddressId("");
                              setSavedAddressPopoverOpen(false);
                            }}
                            type="button"
                          >
                            Enter address manually
                          </button>
                        </li>
                        {savedAddresses.map((addr) => (
                          <li key={addr.id}>
                            <button
                              className={cn(
                                `
                                  w-full px-3 py-2 text-left text-sm
                                  hover:bg-muted/80
                                `,
                                selectedSavedAddressId === addr.id &&
                                  "bg-muted/50",
                              )}
                              onClick={() => {
                                setSelectedSavedAddressId(addr.id);
                                applySavedAddress(addr);
                                setSavedAddressPopoverOpen(false);
                              }}
                              type="button"
                            >
                              {addr.label || "Address"} — {addr.address1},{" "}
                              {addr.city}
                              {addr.isDefault ? " (Default)" : ""}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="sm:col-span-2">
                <select
                  aria-invalid={
                    validationErrors.includes("Country is required") ||
                    !canShipToCountry
                  }
                  aria-label="Country"
                  autoComplete="shipping country"
                  className={cn(
                    selectInputClass,
                    (validationErrors.includes("Country is required") ||
                      !canShipToCountry) &&
                      "border-destructive",
                  )}
                  onChange={(e) => update("country", e.target.value)}
                  onFocus={() => preloadStripe()}
                  value={form.country}
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
                  aria-invalid={showFieldError(
                    "First name is required",
                    "firstName",
                  )}
                  aria-label="First name"
                  autoComplete="shipping given-name"
                  className={cn(
                    checkoutFieldHeight,
                    showFieldError("First name is required", "firstName") &&
                      "border-destructive",
                  )}
                  onBlur={() => markTouched("firstName")}
                  onChange={(e) => update("firstName", e.target.value)}
                  onFocus={() => preloadStripe()}
                  placeholder="First name"
                  value={form.firstName}
                />
                {showFieldError("First name is required", "firstName") && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    First name is required
                  </p>
                )}
              </div>
              <div>
                <Input
                  aria-invalid={showFieldError(
                    "Last name is required",
                    "lastName",
                  )}
                  aria-label="Last name"
                  autoComplete="shipping family-name"
                  className={cn(
                    checkoutFieldHeight,
                    showFieldError("Last name is required", "lastName") &&
                      "border-destructive",
                  )}
                  onBlur={() => markTouched("lastName")}
                  onChange={(e) => update("lastName", e.target.value)}
                  onFocus={() => preloadStripe()}
                  placeholder="Last name"
                  value={form.lastName}
                />
                {showFieldError("Last name is required", "lastName") && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    Last name is required
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                {!showCompany ? (
                  <button
                    className={`
                      text-sm text-primary underline-offset-4
                      hover:underline
                    `}
                    onClick={() => setShowCompany(true)}
                    type="button"
                  >
                    Add company
                  </button>
                ) : (
                  <Input
                    aria-label="Company (optional)"
                    autoComplete="shipping organization"
                    autoFocus
                    className={checkoutFieldHeight}
                    onChange={(e) => update("company", e.target.value)}
                    placeholder="Company (optional)"
                    value={form.company}
                  />
                )}
              </div>
              <div
                className={`
                  relative
                  sm:col-span-2
                `}
                ref={shippingLoqate.containerRef}
              >
                <Input
                  aria-autocomplete="list"
                  aria-expanded={shippingLoqate.open}
                  aria-invalid={showFieldError("Address is required", "street")}
                  aria-label="Address"
                  autoComplete="shipping address-line1"
                  className={cn(
                    checkoutFieldHeight,
                    showFieldError("Address is required", "street") &&
                      "border-destructive",
                  )}
                  onBlur={() => {
                    shippingLoqate.inputFocusedRef.current = false;
                    markTouched("street");
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
                  onChange={(e) => update("street", e.target.value)}
                  onFocus={() => {
                    preloadStripe();
                    shippingLoqate.inputFocusedRef.current = true;
                    if (shippingLoqate.suggestions.length > 0)
                      shippingLoqate.setOpen(true);
                  }}
                  placeholder="Address"
                  value={form.street}
                />
                {showFieldError("Address is required", "street") && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    Address is required
                  </p>
                )}
                {shippingLoqate.open &&
                  (shippingLoqate.suggestions.length > 0 ||
                    shippingLoqate.loading) && (
                    <div
                      className={`
                        absolute top-full right-0 left-0 z-50 mt-1 max-h-60
                        overflow-auto rounded-md border border-border
                        bg-background
                      `}
                      role="listbox"
                    >
                      {shippingLoqate.loading &&
                      shippingLoqate.suggestions.length === 0 ? (
                        <div
                          className={`
                            flex items-center gap-2 px-3 py-2 text-sm
                            text-muted-foreground
                          `}
                        >
                          <Spinner className="shrink-0" variant="inline" />
                          Finding addresses…
                        </div>
                      ) : (
                        shippingLoqate.suggestions
                          .filter((item) => item.Type === "Address")
                          .map((item) => (
                            <button
                              className={`
                                w-full cursor-pointer px-3 py-2 text-left
                                text-sm
                                hover:bg-muted
                                focus:bg-muted focus:outline-none
                              `}
                              key={item.Id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                shippingLoqate.selectAddress(item.Id);
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
                  autoComplete="shipping address-line2"
                  className={checkoutFieldHeight}
                  onChange={(e) => update("apartment", e.target.value)}
                  placeholder="Apartment, suite, etc (optional)"
                  value={form.apartment}
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
                    aria-invalid={showFieldError("City is required", "city")}
                    aria-label="City"
                    autoComplete="shipping address-level2"
                    className={cn(
                      checkoutFieldHeight,
                      showFieldError("City is required", "city") &&
                        "border-destructive",
                    )}
                    onBlur={() => markTouched("city")}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="City"
                    value={form.city}
                  />
                  {showFieldError("City is required", "city") && (
                    <p className="mt-1 text-xs text-destructive" role="alert">
                      City is required
                    </p>
                  )}
                </div>
                {isUS ? (
                  <div>
                    <select
                      aria-invalid={validationErrors.includes(
                        "State is required",
                      )}
                      aria-label="State"
                      autoComplete="shipping address-level1"
                      className={cn(
                        selectInputClass,
                        validationErrors.includes("State is required") &&
                          "border-destructive",
                      )}
                      onChange={(e) => update("state", e.target.value)}
                      value={form.state}
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
                      aria-invalid={validationErrors.includes(
                        "State / Province is required",
                      )}
                      aria-label="State / Province"
                      autoComplete="shipping address-level1"
                      className={cn(
                        checkoutFieldHeight,
                        validationErrors.includes(
                          "State / Province is required",
                        ) && "border-destructive",
                      )}
                      onChange={(e) => update("state", e.target.value)}
                      placeholder="State / Province"
                      value={form.state}
                    />
                  </div>
                )}
                <div>
                  <Input
                    aria-invalid={
                      validationErrors.includes("ZIP code is required") ||
                      validationErrors.includes("Postal code is required")
                    }
                    aria-label={isUS ? "ZIP code" : "Postal code"}
                    autoComplete="shipping postal-code"
                    className={cn(
                      checkoutFieldHeight,
                      (validationErrors.includes("ZIP code is required") ||
                        validationErrors.includes("Postal code is required")) &&
                        "border-destructive",
                    )}
                    inputMode="text"
                    onChange={(e) => update("zip", e.target.value)}
                    placeholder={isUS ? "ZIP code" : "Postal code"}
                    value={form.zip}
                  />
                </div>
              </div>
              <div
                className={`
                  flex items-center gap-2
                  sm:col-span-2
                `}
              >
                <Input
                  aria-label={
                    shippingSpeed === "express" ? "Phone (required)" : "Phone"
                  }
                  aria-required={shippingSpeed === "express"}
                  autoComplete="shipping tel"
                  className={cn(checkoutFieldHeight, "min-w-0 flex-1")}
                  inputMode="tel"
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder={
                    shippingSpeed === "express" ? "Phone" : "Phone (optional)"
                  }
                  type="tel"
                  value={form.phone}
                />
                <Popover>
                  <PopoverTrigger
                    aria-label="Why we ask for phone"
                    className={`
                      shrink-0 rounded-full p-1 text-muted-foreground
                      hover:bg-muted hover:text-foreground
                      focus-visible:ring-2 focus-visible:ring-ring
                      focus-visible:outline-none
                    `}
                    type="button"
                  >
                    <CircleHelp aria-hidden className="size-5" />
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className={`
                      max-w-56 border-0 bg-neutral-900 px-3 py-2 text-sm
                      text-white
                      dark:bg-neutral-100 dark:text-neutral-900
                    `}
                    side="top"
                  >
                    In case we need to contact you about your order
                  </PopoverContent>
                </Popover>
              </div>
              {showSaveAddressCheckbox && (
                <div className="sm:col-span-2">
                  <label
                    className={`flex cursor-pointer items-center gap-2 text-sm`}
                  >
                    <Checkbox
                      checked={saveAddressForNextTime}
                      onCheckedChange={(v) =>
                        handleSaveAddressCheckboxChange(v === true)
                      }
                    />
                    <span>Save this address for next time</span>
                  </label>
                </div>
              )}
              {/* Marketing consent moved to success page */}
            </CardContent>
          </Card>

          {/* Shipping method */}
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Shipping method</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div
                className={`
                  flex items-center justify-between rounded-md border
                  border-border p-3
                `}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {shippingLoading
                      ? "Calculating…"
                      : (shippingLabel ?? "Standard")}
                  </span>
                  {!shippingLoading && form.country?.trim() && (
                    <span className="text-xs text-muted-foreground">
                      {form.country === "US"
                        ? "Estimated delivery: 2–4 business days"
                        : "Estimated delivery: 5–14 business days"}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {shippingLoading ? (
                    <Spinner
                      aria-label="Calculating shipping"
                      variant="inline"
                    />
                  ) : shippingFree ? (
                    <span
                      className={`
                        font-medium text-green-600
                        dark:text-green-400
                      `}
                    >
                      Free
                    </span>
                  ) : (
                    <FiatPrice usdAmount={shippingCents / 100} />
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
};
