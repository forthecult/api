"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from "react";

import { useCart } from "~/lib/hooks/use-cart";
import { useCurrentUser } from "~/lib/auth-client";
import { defaultForm } from "./checkout-shared";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { getAffiliateCodeFromDocument } from "~/lib/affiliate-tracking";
import { OrderSummary } from "./components/OrderSummary";
import {
  ShippingAddressForm,
  type ShippingAddressFormRef,
  type ShippingUpdate,
} from "./components/ShippingAddressForm";
import {
  BillingAddressForm,
  type BillingAddressFormRef,
} from "./components/BillingAddressForm";
import { PaymentMethodSection } from "./components/PaymentMethodSection";
import { checkoutReducer, initialCheckoutState } from "./checkout-reducer";
import { useCoupons } from "./hooks/useCoupons";

function getAffiliatePayload(): { affiliateCode?: string } {
  const code = getAffiliateCodeFromDocument();
  return code ? { affiliateCode: code } : {};
}

/** When checkout is opened from Telegram Mini App (source=telegram or path /telegram/*), include Telegram user in create-order payload. */
function getTelegramOrderPayload(): {
  telegramUserId?: string;
  telegramUsername?: string;
  telegramFirstName?: string;
} {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname ?? "";
  const fromTelegram =
    params.get("source") === "telegram" || pathname.startsWith("/telegram");
  if (!fromTelegram) return {};
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return {};
  return {
    telegramUserId: String(user.id),
    ...(user.username ? { telegramUsername: user.username } : {}),
    ...(user.first_name ? { telegramFirstName: user.first_name } : {}),
    // [SECURITY] Include signed initData so the server can verify it via HMAC
    // before trusting the Telegram user identity (initDataUnsafe is client-tamperable)
    ...(window.Telegram?.WebApp?.initData
      ? { telegramInitData: window.Telegram.WebApp.initData }
      : {}),
  };
}

/** All countries we ship to (from site country list, excluding restricted). */
const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select country" },
  ...COUNTRY_OPTIONS_ALPHABETICAL.filter(
    (o) => !isShippingExcluded(o.code),
  ).map((o) => ({ value: o.code, label: o.countryName })),
];

/** Stub ref for digital-only checkout when user is logged in: no form shown, ref exposes user email. */
const DigitalOnlyStubRef = forwardRef<
  ShippingAddressFormRef,
  { user: { email?: string } | null }
>(function DigitalOnlyStubRef({ user }, ref) {
  useImperativeHandle(
    ref,
    () => ({
      getForm: () => ({ ...defaultForm, email: user?.email ?? "" }),
      getEmailNews: () => false,
      getTextNews: () => false,
      validate: () => [],
      persistForm: () => {},
    }),
    [user?.email],
  );
  return null;
});

export function CheckoutClient() {
  const { isHydrated, items, subtotal, itemCount, updateQuantity, removeItem } =
    useCart();
  const { user, isPending: authPending } = useCurrentUser();
  const { selectedCountry } = useCountryCurrency();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? undefined;
  const isLoggedIn = Boolean(user?.email);
  const isDigitalOnly =
    items.length > 0 &&
    items.every((i) => (i as { digital?: boolean }).digital === true);
  const userReceiveMarketing =
    (user as { receiveMarketing?: boolean } | null)?.receiveMarketing === true;
  const userReceiveSmsMarketing =
    (user as { receiveSmsMarketing?: boolean } | null)?.receiveSmsMarketing ===
    true;
  const shippingFormRef = useRef<ShippingAddressFormRef>(null);
  const billingFormRef = useRef<BillingAddressFormRef>(null);

  const [checkoutState, dispatch] = useReducer(
    checkoutReducer,
    initialCheckoutState,
  );
  const { validationErrors, navigatingToPay } = checkoutState;
  const setValidationErrors = useCallback((errors: string[]) => {
    dispatch({ type: "SET_VALIDATION_ERRORS", errors });
  }, []);
  const setNavigatingToPay = useCallback((navigating: boolean) => {
    dispatch({ type: "SET_NAVIGATING", navigating });
  }, []);

  const [shipping, setShipping] = useState<ShippingUpdate>({
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
  /** Crypto total label (e.g. "≈ 0.0875 SOL") set by PaymentMethodSection for OrderSummary. */
  const [cryptoTotalLabel, setCryptoTotalLabel] = useState<string | null>(null);
  /** Selected payment method key (e.g. "crypto_troll") for payment-method discount resolution. */
  const [selectedPaymentMethodKey, setSelectedPaymentMethodKey] = useState<
    string | null
  >(null);

  const handleShippingUpdate = useCallback((update: ShippingUpdate) => {
    setShipping(update);
  }, []);

  // Digital-only cart: force shipping/tax to zero (stub path doesn't run form's useEffect)
  useEffect(() => {
    if (!isDigitalOnly) return;
    handleShippingUpdate({
      shippingCents: 0,
      shippingLabel: null,
      shippingFree: true,
      shippingLoading: false,
      canShipToCountry: true,
      shippingSpeed: "standard",
      taxCents: 0,
      taxNote: null,
      customsDutiesNote: null,
    });
  }, [isDigitalOnly, handleShippingUpdate]);

  const {
    shippingCents,
    shippingFree,
    shippingLoading,
    canShipToCountry,
    shippingSpeed,
    taxCents,
    taxNote,
    customsDutiesNote,
  } = shipping;

  const coupons = useCoupons({
    subtotal,
    shippingCents,
    items,
    paymentMethodKey: selectedPaymentMethodKey,
    wallet,
  });
  const {
    appliedCoupon,
    tierDiscounts,
    tierDiscountTotalCents,
    discountCodeInput,
    setDiscountCodeInput,
    couponError,
    couponLoading,
    showDiscountCode,
    setShowDiscountCode,
    handleApplyCoupon,
    removeCoupon,
  } = coupons;

  /** Build the common order payload used by all payment handlers. */
  const buildOrderPayload = useCallback(() => {
    const form = shippingFormRef.current?.getForm();
    // Marketing consent is now collected on the success page, not at checkout
    const emailNewsVal = false;
    const textNewsVal = false;
    const orderItems = items.map((item) => ({
      productId: item.productId ?? item.id,
      ...(item.productVariantId && { productVariantId: item.productVariantId }),
      name: item.name,
      priceCents: Math.round(item.price * 100),
      quantity: item.quantity,
    }));
    const subtotalCents = orderItems.reduce(
      (sum, i) => sum + i.priceCents * i.quantity,
      0,
    );
    const discountCentsForOrder =
      (appliedCoupon?.discountCents ?? 0) +
      (coupons.tierDiscountTotalCents ?? 0);
    const shippingFeeCentsRounded = Math.round(shippingCents);
    const taxCentsRounded = Math.round(taxCents);
    const orderTotalCents =
      subtotalCents -
      discountCentsForOrder +
      shippingFeeCentsRounded +
      taxCentsRounded;
    const emailRaw = form?.email?.trim();
    const emailValid =
      typeof emailRaw === "string" &&
      emailRaw.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    const email = emailValid ? emailRaw! : "guest@checkout.local";
    return {
      form,
      emailNewsVal,
      textNewsVal,
      orderItems,
      subtotalCents,
      orderTotalCents,
      shippingFeeCentsRounded,
      taxCentsRounded,
      email,
      /** Common body fields shared by all create-order APIs */
      commonBody: {
        email: email.toLowerCase(),
        orderItems,
        totalCents: orderTotalCents,
        shippingFeeCents: shippingFeeCentsRounded,
        taxCents: taxCentsRounded,
        userId: user?.id ?? null,
        emailMarketingConsent:
          isLoggedIn && userReceiveMarketing ? true : emailNewsVal,
        smsMarketingConsent:
          isLoggedIn && userReceiveSmsMarketing ? true : textNewsVal,
        ...getTelegramOrderPayload(),
        ...getAffiliatePayload(),
        ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        ...(wallet ? { wallet } : {}),
      },
    };
  }, [
    items,
    shippingCents,
    taxCents,
    user?.id,
    isLoggedIn,
    userReceiveMarketing,
    userReceiveSmsMarketing,
    appliedCoupon,
    wallet,
    tierDiscountTotalCents,
  ]);

  const hasEsimInCart = items.some((item) => item.digital === true);

  const discountCents =
    (appliedCoupon?.discountCents ?? 0) + tierDiscountTotalCents;
  const totalCents =
    Math.round(subtotal * 100) - discountCents + shippingCents + taxCents;
  const total = Math.max(0, totalCents) / 100;

  if (!isHydrated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Loading…
          </CardTitle>
          <CardDescription>Checking your cart.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your cart is empty</CardTitle>
          <CardDescription>
            Add items from the store before checking out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/products">Browse products</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex w-full justify-center px-4">
      <div className="w-full max-w-5xl">
        {/* Secure checkout header + back link */}
        <div className="flex items-center justify-between pb-2 pt-1">
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">Continue shopping</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            <Lock className="size-3.5" aria-hidden />
            Secure Checkout
          </div>
        </div>

        {/* Progress indicator */}
        <div
          className="mb-6 flex items-center justify-center gap-2 text-sm"
          role="navigation"
          aria-label="Checkout steps"
        >
          <div className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground sm:size-6 sm:text-xs">
              1
            </span>
            <span className="font-medium text-foreground">Information</span>
          </div>
          <div className="h-px w-6 bg-border sm:w-10" aria-hidden />
          <div className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground sm:size-6 sm:text-xs">
              2
            </span>
            <span className="font-medium text-foreground">Shipping</span>
          </div>
          <div className="h-px w-6 bg-border sm:w-10" aria-hidden />
          <div className="flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground sm:size-6 sm:text-xs">
              3
            </span>
            <span className="text-muted-foreground">Payment</span>
          </div>
        </div>

        <div className="grid gap-8 pt-4 sm:grid-cols-[1fr,340px] md:grid-cols-[1fr,380px] lg:grid-cols-[1fr,400px]">
          {/* Left: contact, address, shipping method, payment, place order + policy links */}
          <div className="min-w-0 space-y-6 sm:col-start-1">
            {isDigitalOnly && isLoggedIn ? (
              <DigitalOnlyStubRef
                ref={shippingFormRef}
                user={user ? { email: user.email } : null}
              />
            ) : (
              <ShippingAddressForm
                ref={shippingFormRef}
                countryOptions={COUNTRY_OPTIONS}
                items={items}
                subtotal={subtotal}
                appliedCoupon={appliedCoupon}
                selectedCountry={selectedCountry}
                user={user}
                isLoggedIn={isLoggedIn}
                userReceiveMarketing={userReceiveMarketing}
                userReceiveSmsMarketing={userReceiveSmsMarketing}
                authPending={authPending}
                validationErrors={validationErrors}
                onShippingUpdate={handleShippingUpdate}
                emailOnly={isDigitalOnly}
              />
            )}

            <PaymentMethodSection
              buildOrderPayload={buildOrderPayload}
              shippingFormRef={shippingFormRef}
              billingFormRef={billingFormRef}
              total={total}
              totalCents={totalCents}
              canShipToCountry={canShipToCountry}
              countryOptions={COUNTRY_OPTIONS}
              validationErrors={validationErrors}
              setValidationErrors={setValidationErrors}
              navigatingToPay={navigatingToPay}
              setNavigatingToPay={setNavigatingToPay}
              onCryptoTotalLabelChange={setCryptoTotalLabel}
              hasEsimInCart={hasEsimInCart}
              onPaymentMethodKeyChange={setSelectedPaymentMethodKey}
            />
          </div>
          {/* Right: Your order only — sticky offset below header (max-h-24) so header doesn't overlap */}
          <div className="min-w-0 space-y-6 sm:col-start-2 sm:sticky sm:top-28 sm:self-start">
            <OrderSummary
              items={items}
              itemCount={itemCount}
              subtotal={subtotal}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeItem}
              shippingCents={shippingCents}
              shippingLoading={shippingLoading}
              shippingFree={shippingFree}
              taxCents={taxCents}
              taxNote={taxNote}
              customsDutiesNote={customsDutiesNote}
              appliedCoupon={appliedCoupon}
              tierDiscounts={tierDiscounts}
              tierDiscountTotalCents={tierDiscountTotalCents}
              total={total}
              cryptoTotalLabel={cryptoTotalLabel}
              showDiscountCode={showDiscountCode}
              discountCodeInput={discountCodeInput}
              couponError={couponError}
              couponLoading={couponLoading}
              onShowDiscountCode={() => setShowDiscountCode(true)}
              onDiscountCodeInputChange={setDiscountCodeInput}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={removeCoupon}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
