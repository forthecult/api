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

import { getAffiliateCodeFromDocument } from "~/lib/affiliate-tracking";
import { useCurrentUser } from "~/lib/auth-client";
import { useCart } from "~/lib/hooks/use-cart";
import {
  COUNTRY_OPTIONS_ALPHABETICAL,
  useCountryCurrency,
} from "~/lib/hooks/use-country-currency";
import { isShippingExcluded } from "~/lib/shipping-restrictions";
import { FiatPrice } from "~/ui/components/FiatPrice";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

import { checkoutReducer, initialCheckoutState } from "./checkout-reducer";
import { defaultForm } from "./checkout-shared";
import {
  BillingAddressForm,
  type BillingAddressFormRef,
} from "./components/BillingAddressForm";
import { OrderSummary } from "./components/OrderSummary";
import {
  type PaymentMethodSectionRef,
  PaymentMethodSection,
} from "./components/PaymentMethodSection";
import {
  ShippingAddressForm,
  type ShippingAddressFormRef,
  type ShippingUpdate,
} from "./components/ShippingAddressForm";
import { useCoupons } from "./hooks/useCoupons";

function getAffiliatePayload(): { affiliateCode?: string } {
  const code = getAffiliateCodeFromDocument();
  return code ? { affiliateCode: code } : {};
}

/** When checkout is opened from Telegram Mini App (source=telegram or path /telegram/*), include Telegram user in create-order payload. */
function getTelegramOrderPayload(): {
  telegramFirstName?: string;
  telegramUserId?: string;
  telegramUsername?: string;
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
const COUNTRY_OPTIONS: { label: string; value: string }[] = [
  { label: "Select country", value: "" },
  ...COUNTRY_OPTIONS_ALPHABETICAL.filter(
    (o) => !isShippingExcluded(o.code),
  ).map((o) => ({ label: o.countryName, value: o.code })),
];

/** Stub ref for digital-only checkout when user is logged in: no form shown, ref exposes user email. */
const DigitalOnlyStubRef = function DigitalOnlyStubRef({
  ref,
  user,
}: { ref?: React.RefObject<null | ShippingAddressFormRef> } & {
  user: null | { email?: string };
}) {
  useImperativeHandle(
    ref,
    () => ({
      getEmailNews: () => false,
      getForm: () => ({ ...defaultForm, email: user?.email ?? "" }),
      getTextNews: () => false,
      persistForm: () => {},
      validate: () => [],
    }),
    [user?.email],
  );
  return null;
};

export function CheckoutClient() {
  const { isHydrated, itemCount, items, removeItem, subtotal, updateQuantity } =
    useCart();
  const { isPending: authPending, user } = useCurrentUser();
  const { selectedCountry } = useCountryCurrency();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? undefined;
  const isLoggedIn = Boolean(user?.email);
  const isDigitalOnly =
    items.length > 0 &&
    items.every((i) => (i as { digital?: boolean }).digital === true);
  const userReceiveMarketing =
    (user as null | { receiveMarketing?: boolean })?.receiveMarketing === true;
  const userReceiveSmsMarketing =
    (user as null | { receiveSmsMarketing?: boolean })?.receiveSmsMarketing ===
    true;
  const shippingFormRef = useRef<ShippingAddressFormRef>(null);
  const billingFormRef = useRef<BillingAddressFormRef>(null);
  const paymentSectionRef = useRef<PaymentMethodSectionRef>(null);
  const [canPlaceOrder, setCanPlaceOrder] = useState(false);

  const [checkoutState, dispatch] = useReducer(
    checkoutReducer,
    initialCheckoutState,
  );
  const { navigatingToPay, validationErrors } = checkoutState;
  const setValidationErrors = useCallback((errors: string[]) => {
    dispatch({ errors, type: "SET_VALIDATION_ERRORS" });
  }, []);
  const setNavigatingToPay = useCallback((navigating: boolean) => {
    dispatch({ navigating, type: "SET_NAVIGATING" });
  }, []);

  const [shipping, setShipping] = useState<ShippingUpdate>({
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
  /** Crypto total label (e.g. "≈ 0.0875 SOL") set by PaymentMethodSection for OrderSummary. */
  const [cryptoTotalLabel, setCryptoTotalLabel] = useState<null | string>(null);
  /** Selected payment method key (e.g. "crypto_troll") for payment-method discount resolution. */
  const [selectedPaymentMethodKey, setSelectedPaymentMethodKey] = useState<
    null | string
  >(null);

  const handleShippingUpdate = useCallback((update: ShippingUpdate) => {
    setShipping(update);
  }, []);

  // Digital-only cart: force shipping/tax to zero (stub path doesn't run form's useEffect)
  useEffect(() => {
    if (!isDigitalOnly) return;
    handleShippingUpdate({
      canShipToCountry: true,
      customsDutiesNote: null,
      shippingCents: 0,
      shippingFree: true,
      shippingLabel: null,
      shippingLoading: false,
      shippingSpeed: "standard",
      taxCents: 0,
      taxNote: null,
    });
  }, [isDigitalOnly, handleShippingUpdate]);

  const {
    canShipToCountry,
    customsDutiesNote,
    shippingCents,
    shippingFree,
    shippingLoading,
    shippingSpeed,
    taxCents,
    taxNote,
  } = shipping;

  const coupons = useCoupons({
    items,
    paymentMethodKey: selectedPaymentMethodKey,
    shippingCents,
    subtotal,
    wallet,
  });
  const {
    appliedCoupon,
    couponError,
    couponLoading,
    discountCodeInput,
    handleApplyCoupon,
    removeCoupon,
    setDiscountCodeInput,
    setShowDiscountCode,
    showDiscountCode,
    tierDiscounts,
    tierDiscountTotalCents,
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
      /** Common body fields shared by all create-order APIs */
      commonBody: {
        email: email.toLowerCase(),
        emailMarketingConsent:
          isLoggedIn && userReceiveMarketing ? true : emailNewsVal,
        orderItems,
        shippingFeeCents: shippingFeeCentsRounded,
        smsMarketingConsent:
          isLoggedIn && userReceiveSmsMarketing ? true : textNewsVal,
        taxCents: taxCentsRounded,
        totalCents: orderTotalCents,
        userId: user?.id ?? null,
        ...getTelegramOrderPayload(),
        ...getAffiliatePayload(),
        ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        ...(wallet ? { wallet } : {}),
      },
      email,
      emailNewsVal,
      form,
      orderItems,
      orderTotalCents,
      shippingFeeCentsRounded,
      subtotalCents,
      taxCentsRounded,
      textNewsVal,
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
            <Loader2 aria-hidden className="size-5 animate-spin" />
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
        <div className="flex items-center justify-between pt-1 pb-2">
          <Link
            className={`
              flex items-center gap-1.5 text-sm text-muted-foreground
              transition-colors
              hover:text-foreground
            `}
            href="/products"
          >
            <ArrowLeft aria-hidden className="size-4" />
            <span
              className={`
              hidden
              sm:inline
            `}
            >
              Continue shopping
            </span>
            <span className="sm:hidden">Back</span>
          </Link>
          <div
            className={`
            flex items-center gap-1.5 text-sm font-medium text-green-700
            dark:text-green-400
          `}
          >
            <Lock aria-hidden className="size-3.5" />
            Secure Checkout
          </div>
        </div>

        {/* Progress indicator */}
        <div
          aria-label="Checkout steps"
          className="mb-6 flex items-center justify-center gap-2 text-sm"
          role="navigation"
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`
              flex size-5 items-center justify-center rounded-full bg-primary
              text-[10px] font-bold text-primary-foreground
              sm:size-6 sm:text-xs
            `}
            >
              1
            </span>
            <span className="font-medium text-foreground">Information</span>
          </div>
          <div
            aria-hidden
            className={`
            h-px w-6 bg-border
            sm:w-10
          `}
          />
          <div className="flex items-center gap-1.5">
            <span
              className={`
              flex size-5 items-center justify-center rounded-full bg-primary
              text-[10px] font-bold text-primary-foreground
              sm:size-6 sm:text-xs
            `}
            >
              2
            </span>
            <span className="font-medium text-foreground">Shipping</span>
          </div>
          <div
            aria-hidden
            className={`
            h-px w-6 bg-border
            sm:w-10
          `}
          />
          <div className="flex items-center gap-1.5">
            <span
              className={`
              flex size-5 items-center justify-center rounded-full bg-muted
              text-[10px] font-bold text-muted-foreground
              sm:size-6 sm:text-xs
            `}
            >
              3
            </span>
            <span className="text-muted-foreground">Payment</span>
          </div>
        </div>

        <div
          className={`
          grid gap-8 pt-4
          sm:grid-cols-[1fr,340px]
          md:grid-cols-[1fr,380px]
          lg:grid-cols-[1fr,400px]
        `}
        >
          {/* Left: contact, address, shipping method, payment, place order + policy links */}
          <div
            className={`
            min-w-0 space-y-6
            sm:col-start-1
          `}
          >
            {isDigitalOnly && isLoggedIn ? (
              <DigitalOnlyStubRef
                ref={shippingFormRef}
                user={user ? { email: user.email } : null}
              />
            ) : (
              <ShippingAddressForm
                appliedCoupon={appliedCoupon}
                authPending={authPending}
                countryOptions={COUNTRY_OPTIONS}
                emailOnly={isDigitalOnly}
                isLoggedIn={isLoggedIn}
                items={items}
                onShippingUpdate={handleShippingUpdate}
                ref={shippingFormRef}
                selectedCountry={selectedCountry}
                subtotal={subtotal}
                user={user}
                userReceiveMarketing={userReceiveMarketing}
                userReceiveSmsMarketing={userReceiveSmsMarketing}
                validationErrors={validationErrors}
              />
            )}

            <PaymentMethodSection
              ref={paymentSectionRef}
              billingFormRef={billingFormRef}
              buildOrderPayload={buildOrderPayload}
              canShipToCountry={canShipToCountry}
              countryOptions={COUNTRY_OPTIONS}
              hasEsimInCart={hasEsimInCart}
              navigatingToPay={navigatingToPay}
              onCryptoTotalLabelChange={setCryptoTotalLabel}
              onPaymentMethodKeyChange={setSelectedPaymentMethodKey}
              onPaymentReadyChange={setCanPlaceOrder}
              setNavigatingToPay={setNavigatingToPay}
              setValidationErrors={setValidationErrors}
              shippingFormRef={shippingFormRef}
              total={total}
              totalCents={totalCents}
              validationErrors={validationErrors}
            />
          </div>
          {/* Right: Your order only — sticky offset below header (max-h-24) so header doesn't overlap */}
          <div
            className={`
            min-w-0 space-y-6
            sm:sticky sm:top-28 sm:col-start-2 sm:self-start
          `}
          >
            <OrderSummary
              appliedCoupon={appliedCoupon}
              couponError={couponError}
              couponLoading={couponLoading}
              cryptoTotalLabel={cryptoTotalLabel}
              customsDutiesNote={customsDutiesNote}
              discountCodeInput={discountCodeInput}
              itemCount={itemCount}
              items={items}
              onApplyCoupon={handleApplyCoupon}
              onDiscountCodeInputChange={setDiscountCodeInput}
              onRemoveCoupon={removeCoupon}
              onRemoveItem={removeItem}
              onShowDiscountCode={() => setShowDiscountCode(true)}
              onUpdateQuantity={updateQuantity}
              shippingCents={shippingCents}
              shippingFree={shippingFree}
              shippingLoading={shippingLoading}
              showDiscountCode={showDiscountCode}
              subtotal={subtotal}
              taxCents={taxCents}
              taxNote={taxNote}
              tierDiscounts={tierDiscounts}
              tierDiscountTotalCents={tierDiscountTotalCents}
              total={total}
            />
          </div>
        </div>

        {/* Sticky Place order bar — visible total + CTA so checkout is always obvious */}
        <div
          className={`
            sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between
            gap-4 border-t border-border bg-background/95 px-4 py-4
            backdrop-blur supports-[backdrop-filter]:bg-background/80
          `}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Total
            </span>
            <span className="text-lg font-semibold">
              <FiatPrice usdAmount={total} />
            </span>
          </div>
          <Button
            className="min-w-[12rem] shrink-0"
            disabled={!canPlaceOrder}
            onClick={() => paymentSectionRef.current?.triggerPay()}
            size="lg"
            type="button"
          >
            {canPlaceOrder ? "Place order" : "Select a payment method"}
          </Button>
        </div>
      </div>
    </div>
  );
}
