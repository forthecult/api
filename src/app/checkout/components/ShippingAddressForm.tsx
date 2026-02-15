"use client";

import { ChevronDown, CircleHelp, Eye, EyeOff, Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  forwardRef,
} from "react";
import { signIn } from "~/lib/auth-client";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/ui/primitives/dialog";
import { Checkbox } from "~/ui/primitives/checkbox";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
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

/** Saved address from GET /api/user/addresses */
type SavedAddress = {
  id: string;
  address1: string;
  address2?: string;
  city: string;
  stateCode?: string;
  countryCode: string;
  zip: string;
  phone?: string;
  label?: string;
  isDefault: boolean;
};

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
  items: {
    productId?: string;
    id: string;
    productVariantId?: string;
    quantity: number;
    digital?: boolean;
  }[];
  subtotal: number;
  appliedCoupon: { code: string; freeShipping: boolean } | null;
  selectedCountry: string | null;
  user:
    | { email?: string; firstName?: string; lastName?: string }
    | null
    | undefined;
  isLoggedIn: boolean;
  userReceiveMarketing: boolean;
  userReceiveSmsMarketing: boolean;
  authPending: boolean;
  validationErrors: string[];
  onShippingUpdate: (update: ShippingUpdate) => void;
  /** When true, only show email field and skip shipping address/method (e.g. digital-only cart). */
  emailOnly?: boolean;
}

export interface ShippingAddressFormRef {
  getForm: () => CheckoutFormState;
  getEmailNews: () => boolean;
  getTextNews: () => boolean;
  validate: () => string[];
  persistForm: () => void;
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
  shippingSpeed: "standard" | "express",
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
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
          className="mt-2 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(e);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="checkout-signin-email">Email</Label>
            <Input
              id="checkout-signin-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              required
              disabled={loading}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="checkout-signin-password">Password</Label>
            <div className="relative">
              <Input
                id="checkout-signin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                className="pr-9"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
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
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
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
    emailOnly = false,
  },
  ref,
) {
  const [form, setForm] = useState<CheckoutFormState>(() =>
    getPersistedShippingForm(),
  );
  const [emailNews, setEmailNews] = useState(true);
  const [textNews, setTextNews] = useState(false);
  const [showCompany, setShowCompany] = useState(() =>
    Boolean(getPersistedShippingForm().company?.trim()),
  );
  /** Track which fields the user has touched (blurred) for inline validation. */
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
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
      street: mapped.street,
      apartment: mapped.apartment || prev.apartment,
      city: mapped.city,
      state: mapped.state,
      zip: mapped.zip,
      country: mapped.country || prev.country,
    }));
  }, []);

  const applySavedAddress = useCallback((addr: SavedAddress) => {
    setForm((prev) => ({
      ...prev,
      street: addr.address1,
      apartment: addr.address2 ?? "",
      city: addr.city,
      state: addr.stateCode ?? "",
      country: addr.countryCode,
      zip: addr.zip,
      phone: addr.phone ?? "",
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

  /** Fetch saved addresses for logged-in users. */
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    fetch("/api/user/addresses", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { addresses: [] }))
      .then((data: { addresses?: SavedAddress[] }) => {
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
      shippingCents: 0,
      shippingLabel: null,
      shippingFree: false,
      shippingLoading: false,
      canShipToCountry: true,
      shippingSpeed: "standard",
      taxCents: 0,
      taxNote: null,
      customsDutiesNote: null,
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
            updateShipping({
              shippingCents:
                typeof data.shippingCents === "number" ? data.shippingCents : 0,
              shippingLabel: data.label ?? null,
              shippingFree: Boolean(data.freeShipping),
              shippingLoading: false,
              canShipToCountry: data.canShipToCountry !== false,
              shippingSpeed:
                data.shippingSpeed === "express" ? "express" : "standard",
              taxCents: typeof data.taxCents === "number" ? data.taxCents : 0,
              taxNote: data.taxNote ?? null,
              customsDutiesNote: data.customsDutiesNote ?? null,
            });
          }
        },
      )
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
      getForm: () => form,
      getEmailNews: () => emailNews,
      getTextNews: () => textNews,
      validate,
      persistForm: () => persistShippingForm(form),
    }),
    [form, emailNews, textNews, validate],
  );

  const {
    shippingCents,
    shippingLabel,
    shippingFree,
    shippingLoading,
    canShipToCountry,
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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Contact</CardTitle>
          {!isLoggedIn && <CheckoutSignInDialog />}
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
                autoComplete="email"
                inputMode="email"
                className={cn(
                  checkoutFieldHeight,
                  touchedFields.has("email") &&
                    form.email?.trim() &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
                    "border-destructive",
                )}
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                onBlur={() => markTouched("email")}
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
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {savedAddresses.length > 0 && (
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Use a saved address
                  </Label>
                  <Popover
                    open={savedAddressPopoverOpen}
                    onOpenChange={setSavedAddressPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Use a saved address"
                        aria-haspopup="listbox"
                        aria-expanded={savedAddressPopoverOpen}
                        className={cn(
                          selectInputClass,
                          "mt-1.5 flex w-full items-center justify-between gap-2 text-left",
                        )}
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
                      className="max-h-[min(60vh,320px)] w-[var(--radix-popover-trigger-width)] overflow-auto p-0"
                      onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                      <ul
                        role="listbox"
                        aria-label="Use a saved address"
                        className="py-1"
                      >
                        <li role="option">
                          <button
                            type="button"
                            className={cn(
                              "w-full px-3 py-2 text-left text-sm hover:bg-muted/80",
                              !selectedSavedAddressId && "bg-muted/50",
                            )}
                            onClick={() => {
                              setSelectedSavedAddressId("");
                              setSavedAddressPopoverOpen(false);
                            }}
                          >
                            Enter address manually
                          </button>
                        </li>
                        {savedAddresses.map((addr) => (
                          <li key={addr.id} role="option">
                            <button
                              type="button"
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm hover:bg-muted/80",
                                selectedSavedAddressId === addr.id &&
                                  "bg-muted/50",
                              )}
                              onClick={() => {
                                setSelectedSavedAddressId(addr.id);
                                applySavedAddress(addr);
                                setSavedAddressPopoverOpen(false);
                              }}
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
                  aria-label="Country"
                  autoComplete="shipping country"
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
                  autoComplete="shipping given-name"
                  aria-invalid={showFieldError(
                    "First name is required",
                    "firstName",
                  )}
                  className={cn(
                    checkoutFieldHeight,
                    showFieldError("First name is required", "firstName") &&
                      "border-destructive",
                  )}
                  placeholder="First name"
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  onBlur={() => markTouched("firstName")}
                />
                {showFieldError("First name is required", "firstName") && (
                  <p className="mt-1 text-xs text-destructive" role="alert">
                    First name is required
                  </p>
                )}
              </div>
              <div>
                <Input
                  aria-label="Last name"
                  autoComplete="shipping family-name"
                  aria-invalid={showFieldError(
                    "Last name is required",
                    "lastName",
                  )}
                  className={cn(
                    checkoutFieldHeight,
                    showFieldError("Last name is required", "lastName") &&
                      "border-destructive",
                  )}
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={(e) => update("lastName", e.target.value)}
                  onBlur={() => markTouched("lastName")}
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
                    type="button"
                    onClick={() => setShowCompany(true)}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Add company
                  </button>
                ) : (
                  <Input
                    aria-label="Company (optional)"
                    autoComplete="shipping organization"
                    className={checkoutFieldHeight}
                    placeholder="Company (optional)"
                    value={form.company}
                    onChange={(e) => update("company", e.target.value)}
                    autoFocus
                  />
                )}
              </div>
              <div
                className="relative sm:col-span-2"
                ref={shippingLoqate.containerRef}
              >
                <Input
                  aria-label="Address"
                  autoComplete="shipping address-line1"
                  aria-autocomplete="list"
                  aria-expanded={shippingLoqate.open}
                  aria-invalid={showFieldError("Address is required", "street")}
                  className={cn(
                    checkoutFieldHeight,
                    showFieldError("Address is required", "street") &&
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
                  autoComplete="shipping address-line2"
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
                    autoComplete="shipping address-level2"
                    aria-invalid={showFieldError("City is required", "city")}
                    className={cn(
                      checkoutFieldHeight,
                      showFieldError("City is required", "city") &&
                        "border-destructive",
                    )}
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    onBlur={() => markTouched("city")}
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
                      aria-label="State"
                      autoComplete="shipping address-level1"
                      aria-invalid={validationErrors.includes(
                        "State is required",
                      )}
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
                      autoComplete="shipping address-level1"
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
                    autoComplete="shipping postal-code"
                    inputMode="text"
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
                    shippingSpeed === "express" ? "Phone (required)" : "Phone"
                  }
                  autoComplete="shipping tel"
                  inputMode="tel"
                  aria-required={shippingSpeed === "express"}
                  className={cn(checkoutFieldHeight, "min-w-0 flex-1")}
                  placeholder={
                    shippingSpeed === "express" ? "Phone" : "Phone (optional)"
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
              {showSaveAddressCheckbox && (
                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
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
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-border p-3">
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
                    <Loader2
                      className="size-4 animate-spin"
                      aria-label="Calculating shipping"
                    />
                  ) : shippingFree ? (
                    <span className="font-medium text-green-600 dark:text-green-400">
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
});
