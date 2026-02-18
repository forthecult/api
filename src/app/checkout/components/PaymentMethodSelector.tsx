"use client";

import type BigNumber from "bignumber.js";

import { createQR, encodeURL } from "@solana/pay";
import { PublicKey } from "@solana/web3-compat";
import { Loader2, Lock } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { PAYMENT_CONFIG } from "~/app";
import {
  prefetchBtcPayClient,
  prefetchCryptoPayClient,
  prefetchEthPayClient,
  prefetchTonPayClient,
} from "~/app/checkout/prefetch-checkout";
import {
  getHiddenFromVisibility,
  hasAnyCryptoEnabled,
  hasAnyStablecoinEnabled,
  visibleCryptoSubFromVisibility,
  visibleUsdcNetworks,
  visibleUsdtNetworks,
} from "~/lib/checkout-payment-options";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";
import {
  getSolanaPayLabel,
  getSolanaPayRecipient,
  USDC_MINT_MAINNET,
  usdcAmountFromUsd,
} from "~/lib/solana-pay";
import { Button } from "~/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";

import type { OrderPayload } from "../checkout-shared";
import type { ShippingAddressFormRef } from "./ShippingAddressForm";

import {
  CRYPTO_LOGO_SRC,
  ETH_CHAIN_OPTIONS,
  HIDDEN_PAYMENT_OPTIONS,
  INITIAL_CRYPTO_SUB,
  OTHER_SUB_OPTIONS,
  STABLECOIN_CHAIN_LOGO,
  STABLECOIN_TOKEN_LOGO,
  USDC_SUB_OPTIONS,
  USDT_SUB_OPTIONS,
  VISIBLE_CRYPTO_SUB_OPTIONS,
} from "../checkout-payment-constants";
import {
  ESIM_REFUND_POPUP_ITEMS,
  paymentButtonClass,
  paymentOptionRowClass,
} from "../checkout-shared";
import { useSolanaPayCheckout } from "../hooks/useSolanaPayCheckout";
import { preloadStripe } from "../stripe-preload";
import {
  BillingAddressForm,
  type BillingAddressFormRef,
} from "./BillingAddressForm";
import { ExpressCheckout } from "./ExpressCheckout";
import { PolicyPopup } from "./PolicyPopup";
import { SolanaPayDialog } from "./solana-pay-dialog";
import {
  StripeCardPayment,
  type StripeCardPaymentRef,
} from "./StripeCardPayment";

type CryptoSub =
  | "bitcoin"
  | "crust"
  | "dogecoin"
  | "eth"
  | "monero"
  | "other"
  | "pump"
  | "seeker"
  | "solana"
  | "soluna"
  | "troll"
  | "cult";
type PaymentMethodTop = "credit-card" | "crypto" | "paypal" | "stablecoins";
type UsdcSub = "arbitrum" | "base" | "ethereum" | "polygon" | "solana";
type UsdtSub = "arbitrum" | "bnb" | "ethereum" | "polygon";

const EVM_CHAINS = ["ethereum", "arbitrum", "base", "polygon"] as const;
const EVM_CHAINS_AND_BNB = [
  "ethereum",
  "arbitrum",
  "base",
  "polygon",
  "bnb",
] as const;

export interface PaymentMethodSelectorProps {
  billingFormRef: React.RefObject<BillingAddressFormRef | null>;
  buildOrderPayload: () => OrderPayload;
  canShipToCountry: boolean;
  countryOptions: { label: string; value: string }[];
  /** When true, refund policy popup includes eSIM-specific rules. */
  hasEsimInCart?: boolean;
  navigatingToPay: boolean;
  onCryptoTotalLabelChange?: (label: null | string) => void;
  /** Callback when the selected payment method key changes (for discount resolution). */
  onPaymentMethodKeyChange?: (key: null | string) => void;
  /** Called when user can place order (payment method + sub-option selected). Used for sticky Place order bar. */
  onPaymentReadyChange?: (canPlaceOrder: boolean) => void;
  setNavigatingToPay: (v: boolean) => void;
  setValidationErrors: (errors: string[]) => void;
  shippingFormRef: React.RefObject<null | ShippingAddressFormRef>;
  total: number;
  totalCents: number;
  validationErrors: string[];
}

export interface PaymentMethodSelectorRef {
  canPlaceOrder: boolean;
  /** Current payment method key (e.g. "stripe", "crypto_solana") or null if none selected. */
  getPaymentMethod: () => null | string;
  /** Ref to the Stripe card payment instance when credit card is selected; null otherwise. Use for advanced flows (e.g. programmatic submit). */
  getStripeCardRef: () => null | StripeCardPaymentRef;
  triggerPay: () => void;
  /** Run shipping + billing validation, set validation errors, return true if valid. */
  validate: () => boolean;
}

export const PaymentMethodSelector = forwardRef<
  PaymentMethodSelectorRef,
  PaymentMethodSelectorProps
>(function PaymentMethodSelector(
  {
    billingFormRef,
    buildOrderPayload,
    canShipToCountry,
    countryOptions,
    hasEsimInCart = false,
    navigatingToPay,
    onCryptoTotalLabelChange,
    onPaymentMethodKeyChange,
    onPaymentReadyChange,
    setNavigatingToPay,
    setValidationErrors,
    shippingFormRef,
    total,
    totalCents,
    validationErrors,
  },
  ref,
) {
  const router = useRouter();
  const payHandlerRef = useRef<() => void>(() => {});
  const validateRef = useRef<() => boolean>(() => false);

  const [paymentMethod, setPaymentMethod] = useState<"" | PaymentMethodTop>("");
  const [stablecoinToken, setStablecoinToken] = useState<"usdc" | "usdt">(
    "usdc",
  );
  const [paymentSubOption, setPaymentSubOption] = useState<
    "" | CryptoSub | UsdcSub | UsdtSub
  >(INITIAL_CRYPTO_SUB);
  const [cryptoOtherSubOption, setCryptoOtherSubOption] = useState<
    "" | "sui" | "ton"
  >("");
  const [cryptoEthChain, setCryptoEthChain] = useState<
    "arbitrum" | "base" | "ethereum" | "polygon"
  >("ethereum");
  const stripeCardRef = useRef<StripeCardPaymentRef>(null);
  const [cardLogosOpen, setCardLogosOpen] = useState(false);
  const cardLogosCloseTimeoutRef = useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );

  // Compute the payment method key (matching PAYMENT_METHOD_DEFAULTS); used for callback and ref.
  const paymentMethodKey = useMemo((): null | string => {
    if (paymentMethod === "credit-card") return "stripe";
    if (paymentMethod === "paypal") return "paypal";
    if (paymentMethod === "crypto") {
      const sub = paymentSubOption;
      if (sub === "bitcoin") return "crypto_bitcoin";
      if (sub === "dogecoin") return "crypto_dogecoin";
      if (sub === "eth") return "crypto_ethereum";
      if (sub === "solana") return "crypto_solana";
      if (sub === "monero") return "crypto_monero";
      if (sub === "crust") return "crypto_crust";
      if (sub === "pump") return "crypto_pump";
      if (sub === "troll") return "crypto_troll";
      if (sub === "soluna") return "crypto_soluna";
      if (sub === "seeker") return "crypto_seeker";
      if (sub === "cult") return "crypto_cult";
      if (sub === "other") {
        if (cryptoOtherSubOption === "sui") return "crypto_sui";
        if (cryptoOtherSubOption === "ton") return "crypto_ton";
      }
      return null;
    }
    if (paymentMethod === "stablecoins") {
      if (stablecoinToken === "usdc") return "stablecoin_usdc";
      if (stablecoinToken === "usdt") return "stablecoin_usdt";
    }
    return null;
  }, [
    paymentMethod,
    paymentSubOption,
    cryptoOtherSubOption,
    stablecoinToken,
  ]);

  useEffect(() => {
    onPaymentMethodKeyChange?.(paymentMethodKey);
  }, [paymentMethodKey, onPaymentMethodKeyChange]);

  const {
    amountUsd: solanaPayAmountUsd,
    closeDialog: closeSolanaPayDialog,
    open: solanaPayOpen,
    openDialog: openSolanaPayDialog,
    orderId: solanaPayOrderId,
    paymentUrl: solanaPayPaymentUrl,
    recipientAddress: solanaPayRecipientAddress,
    status: solanaPayStatus,
  } = useSolanaPayCheckout({
    buildOrderPayload,
    total,
  });

  const [cryptoPrices, setCryptoPrices] = useState<{
    CRUST?: number;
    CULT?: number;
    PUMP?: number;
    SKR?: number;
    SOL?: number;
    SOLUNA?: number;
    TROLL?: number;
  }>({});

  const { currency } = useCountryCurrency();
  const { visibility } = usePaymentMethodSettings();
  const hiddenOptions = useMemo(
    () =>
      visibility ? getHiddenFromVisibility(visibility) : HIDDEN_PAYMENT_OPTIONS,
    [visibility],
  );
  const solanaPayConfigured = Boolean(getSolanaPayRecipient());

  const canPlaceOrder = Boolean(
    paymentMethod !== "" &&
      (paymentMethod !== "crypto" || paymentSubOption !== "") &&
      (paymentMethod !== "stablecoins" || paymentSubOption !== ""),
  );

  useEffect(() => {
    onPaymentReadyChange?.(canPlaceOrder);
  }, [canPlaceOrder, onPaymentReadyChange]);

  useImperativeHandle(
    ref,
    () => ({
      canPlaceOrder,
      getPaymentMethod: () => paymentMethodKey,
      getStripeCardRef: () => stripeCardRef.current,
      triggerPay: () => payHandlerRef.current(),
      validate: () => validateRef.current(),
    }),
    [canPlaceOrder, paymentMethodKey],
  );

  useEffect(() => {
    if (paymentMethod !== "crypto") return;
    const ac = new AbortController();
    fetch("/api/crypto/prices", { signal: ac.signal })
      .then((res) => res.json())
      .then(
        (data: {
          CRUST?: number;
          CULT?: number;
          PUMP?: number;
          SKR?: number;
          SOL?: number;
          SOLUNA?: number;
          TROLL?: number;
        }) => {
          if (data && typeof data === "object") setCryptoPrices(data);
        },
      )
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Prices will use fallback values if fetch fails
      });
    return () => ac.abort();
  }, [paymentMethod]);

  const visibleCryptoSubOptions = useMemo(() => {
    const base = visibility
      ? visibleCryptoSubFromVisibility(visibility)
      : VISIBLE_CRYPTO_SUB_OPTIONS;
    return base.filter((opt) => opt.value !== "solana" || solanaPayConfigured);
  }, [visibility, solanaPayConfigured]);
  const showCryptoRow = visibility === null || hasAnyCryptoEnabled(visibility);
  const showStablecoinsRow =
    visibility === null || hasAnyStablecoinEnabled(visibility);

  /** Icons shown in the collapsed Crypto row — only enabled methods. */
  const cryptoRowIcons = useMemo(() => {
    const icons: { alt: string; src: string }[] = [];
    if (!visibility) {
      // Fallback before API loads: show icons matching VISIBLE_CRYPTO_SUB_OPTIONS
      if (!HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin)
        icons.push({ alt: "Bitcoin", src: "/crypto/bitcoin/bitcoin-logo.svg" });
      icons.push({
        alt: "Ethereum",
        src: "/crypto/ethereum/ethereum-logo.svg",
      });
      icons.push({ alt: "Solana", src: "/crypto/solana/solanaLogoMark.svg" });
      if (!HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin)
        icons.push({ alt: "Dogecoin", src: "/payments/doge.svg" });
      if (!HIDDEN_PAYMENT_OPTIONS.cryptoMonero)
        icons.push({
          alt: "Monero",
          src: "/crypto/monero/monero-xmr-logo.svg",
        });
      return icons;
    }
    if (visibility.cryptoBitcoin)
      icons.push({ alt: "Bitcoin", src: "/crypto/bitcoin/bitcoin-logo.svg" });
    if (visibility.cryptoEthereum)
      icons.push({
        alt: "Ethereum",
        src: "/crypto/ethereum/ethereum-logo.svg",
      });
    if (visibility.cryptoSolana)
      icons.push({ alt: "Solana", src: "/crypto/solana/solanaLogoMark.svg" });
    if (visibility.cryptoDogecoin)
      icons.push({ alt: "Dogecoin", src: "/payments/doge.svg" });
    if (visibility.cryptoMonero)
      icons.push({ alt: "Monero", src: "/crypto/monero/monero-xmr-logo.svg" });
    if (visibility.cryptoCrust)
      icons.push({ alt: "Crust", src: "/crypto/solana/solanaLogoMark.svg" });
    if (visibility.cryptoPump)
      icons.push({ alt: "Pump", src: "/crypto/pump/pump-logomark.svg" });
    if (visibility.cryptoTroll)
      icons.push({ alt: "Troll", src: "/crypto/troll/troll-logomark.png" });
    if (visibility.cryptoSui)
      icons.push({ alt: "Sui", src: "/crypto/sui/sui-logo.svg" });
    if (visibility.cryptoTon)
      icons.push({ alt: "TON", src: "/crypto/ton/ton_logo.svg" });
    if (visibility.cryptoSeeker)
      icons.push({
        alt: "Seeker (SKR)",
        src: "/crypto/seeker/S_Token_Circle_White.svg",
      });
    if (visibility.cryptoCult)
      icons.push({
        alt: "CULT (CULT)",
        src: "/crypto/cult/cult-logo.png",
      });
    return icons;
  }, [visibility]);
  const visibleUsdcSubOptions = useMemo(() => {
    const base =
      visibility !== null ? visibleUsdcNetworks(visibility) : USDC_SUB_OPTIONS;
    return base.filter((opt) => opt.value !== "solana" || solanaPayConfigured);
  }, [visibility, solanaPayConfigured]);
  const visibleUsdtSubOptions = useMemo(
    () =>
      visibility !== null ? visibleUsdtNetworks(visibility) : USDT_SUB_OPTIONS,
    [visibility],
  );

  const showUsdcOption =
    visibility === null || visibility?.stablecoinUsdc === true;
  const showUsdtOption =
    visibility === null || visibility?.stablecoinUsdt === true;

  useEffect(() => {
    if (paymentMethod !== "stablecoins") return;
    if (!showUsdcOption && showUsdtOption) setStablecoinToken("usdt");
    else if (showUsdcOption && !showUsdtOption) setStablecoinToken("usdc");
  }, [paymentMethod, showUsdcOption, showUsdtOption]);

  const isSolanaPaySupported =
    solanaPayConfigured &&
    ((paymentMethod === "stablecoins" &&
      stablecoinToken === "usdc" &&
      paymentSubOption === "solana") ||
      (paymentMethod === "crypto" && paymentSubOption === "crust") ||
      (paymentMethod === "crypto" && paymentSubOption === "pump") ||
      (paymentMethod === "crypto" && paymentSubOption === "troll") ||
      (paymentMethod === "crypto" && paymentSubOption === "soluna") ||
      (paymentMethod === "crypto" && paymentSubOption === "seeker") ||
      (paymentMethod === "crypto" && paymentSubOption === "cult") ||
      (paymentMethod === "crypto" && paymentSubOption === "solana"));

  const isEvmPaySupported =
    (paymentMethod === "crypto" &&
      paymentSubOption === "eth" &&
      EVM_CHAINS.includes(cryptoEthChain)) ||
    (paymentMethod === "stablecoins" &&
      stablecoinToken === "usdc" &&
      EVM_CHAINS.includes(paymentSubOption as (typeof EVM_CHAINS)[number])) ||
    (paymentMethod === "stablecoins" &&
      stablecoinToken === "usdt" &&
      EVM_CHAINS_AND_BNB.includes(
        paymentSubOption as (typeof EVM_CHAINS_AND_BNB)[number],
      ));

  const isSuiPaySupported =
    paymentMethod === "crypto" &&
    paymentSubOption === "other" &&
    cryptoOtherSubOption === "sui";
  const isTonPaySupported =
    paymentMethod === "crypto" &&
    paymentSubOption === "other" &&
    cryptoOtherSubOption === "ton";
  const isBtcPaySupported =
    paymentMethod === "crypto" &&
    (paymentSubOption === "bitcoin" ||
      paymentSubOption === "dogecoin" ||
      paymentSubOption === "monero");

  const cryptoTotalLabel = useMemo(() => {
    const formatCrypto = (value: number, maxFractionDigits = 6) =>
      new Intl.NumberFormat(undefined, {
        maximumFractionDigits: maxFractionDigits,
        minimumFractionDigits: 0,
        useGrouping: true,
      }).format(value);
    if (total <= 0) return null;
    // When display currency is not USD and customer selects USDC/USDT, show the stablecoin amount
    if (
      paymentMethod === "stablecoins" &&
      currency !== "USD" &&
      (stablecoinToken === "usdc" || stablecoinToken === "usdt")
    ) {
      // USDC/USDT are 1:1 with USD
      const label = stablecoinToken === "usdc" ? "USDC" : "USDT";
      return `≈ ${formatCrypto(total, 2)} ${label}`;
    }
    if (paymentMethod !== "crypto") return null;
    if (paymentSubOption === "solana") {
      const rate = cryptoPrices.SOL;
      if (typeof rate !== "number" || rate <= 0) return null;
      const amount = total / rate;
      return `≈ ${formatCrypto(amount, 4)} SOL`;
    }
    if (paymentSubOption === "crust") {
      const rate = cryptoPrices.CRUST;
      if (typeof rate !== "number" || rate <= 0) return null;
      const amount = total / rate;
      return `≈ ${formatCrypto(amount, 6)} CRUST`;
    }
    if (paymentSubOption === "pump") {
      const rate = cryptoPrices.PUMP;
      if (typeof rate !== "number" || rate <= 0) return null;
      const amount = total / rate;
      return `≈ ${formatCrypto(amount, 6)} PUMP`;
    }
    if (paymentSubOption === "troll") {
      const rate = cryptoPrices.TROLL;
      if (typeof rate !== "number" || rate <= 0) return null;
      const amount = total / rate;
      return `≈ ${formatCrypto(amount, 6)} TROLL`;
    }
    if (paymentSubOption === "seeker") {
      const rate = cryptoPrices.SKR;
      if (typeof rate !== "number" || rate <= 0) return null;
      const amount = total / rate;
      return `≈ ${formatCrypto(amount, 6)} SKR`;
    }
    if (paymentSubOption === "soluna") {
      const rate = cryptoPrices.SOLUNA;
      if (typeof rate !== "number" || rate <= 0) return null;
      const amount = total / rate;
      return `≈ ${formatCrypto(amount, 6)} SOLUNA`;
    }
    if (paymentSubOption === "cult") {
      const rate = cryptoPrices.CULT;
      if (typeof rate !== "number" || rate <= 0) return null;
      const amount = total / rate;
      return `≈ ${formatCrypto(amount, 6)} CULT`;
    }
    return null;
  }, [
    paymentMethod,
    paymentSubOption,
    total,
    currency,
    stablecoinToken,
    cryptoPrices.SOL,
    cryptoPrices.CRUST,
    cryptoPrices.PUMP,
    cryptoPrices.TROLL,
    cryptoPrices.SKR,
    cryptoPrices.SOLUNA,
    cryptoPrices.CULT,
  ]);

  useEffect(() => {
    onCryptoTotalLabelChange?.(cryptoTotalLabel);
  }, [cryptoTotalLabel, onCryptoTotalLabelChange]);

  const validateForPayment = useCallback((): boolean => {
    const shippingErr = shippingFormRef.current?.validate() ?? [];
    const useShippingAsBillingVal =
      billingFormRef.current?.getUseShippingAsBilling() ?? true;
    const billingErr = !useShippingAsBillingVal
      ? (billingFormRef.current?.validate() ?? [])
      : [];
    const all = [...shippingErr, ...billingErr];
    setValidationErrors(all);
    return all.length === 0;
  }, [shippingFormRef, billingFormRef, setValidationErrors]);

  validateRef.current = validateForPayment;

  const setPaymentTop = useCallback(
    (method: PaymentMethodTop) => {
      setPaymentMethod(method);
      setValidationErrors([]);
      if (method === "crypto") {
        setPaymentSubOption("");
        setCryptoOtherSubOption("");
      } else if (method === "stablecoins") {
        setStablecoinToken("usdc");
        setPaymentSubOption("solana" as UsdcSub);
      }
    },
    [setValidationErrors],
  );

  const handlePlaceOrder = useCallback(async () => {
    const shippingErr = shippingFormRef.current?.validate() ?? [];
    const useShippingAsBillingVal =
      billingFormRef.current?.getUseShippingAsBilling() ?? true;
    const billingErr = !useShippingAsBillingVal
      ? (billingFormRef.current?.validate() ?? [])
      : [];
    const all = [...shippingErr, ...billingErr];
    setValidationErrors(all);
    if (all.length > 0) return;

    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();

    try {
      const { commonBody, orderItems } = buildOrderPayload();
      const res = await fetch("/api/payments/stripe/create-checkout-session", {
        body: JSON.stringify({
          affiliateCode:
            typeof commonBody.affiliateCode === "string"
              ? commonBody.affiliateCode
              : undefined,
          lineItems: orderItems.map((item) => ({
            productId: item.productId,
            productVariantId: item.productVariantId,
            quantity: item.quantity,
          })),
          paymentMethod:
            paymentMethod === "paypal" ? ("paypal" as const) : undefined,
          userId: commonBody.userId ?? undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setNavigatingToPay(false);
        setValidationErrors([
          data?.error || "Could not create checkout session. Please try again.",
        ]);
        return;
      }

      const data = (await res.json()) as {
        confirmationToken?: string;
        url: string;
      };
      if (data.url) {
        // Store confirmation token before navigating to Stripe
        // (sessionStorage persists across same-tab navigation to external sites and back)
        if (data.confirmationToken) {
          try {
            sessionStorage.setItem(
              "checkout_stripe_ct",
              data.confirmationToken,
            );
          } catch {}
        }
        window.location.href = data.url;
      } else {
        setNavigatingToPay(false);
        setValidationErrors([
          "Could not redirect to payment. Please try again.",
        ]);
      }
    } catch {
      setNavigatingToPay(false);
      setValidationErrors([
        "Payment failed. Please try again or use another payment method.",
      ]);
    }
  }, [
    paymentMethod,
    shippingFormRef,
    billingFormRef,
    buildOrderPayload,
    setValidationErrors,
    setNavigatingToPay,
  ]);

  const handlePayWithSolana = useCallback(() => {
    if (!validateForPayment()) return;
    shippingFormRef.current?.persistForm();
    openSolanaPayDialog();
  }, [validateForPayment, openSolanaPayDialog, shippingFormRef]);

  const handleGoToCryptoPay = useCallback(async () => {
    if (!validateForPayment()) return;
    prefetchCryptoPayClient();
    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();
    const isSui = paymentMethod === "crypto" && cryptoOtherSubOption === "sui";
    if (isSui) {
      const invoiceId = crypto.randomUUID();
      const amount = total;
      const expires = Date.now() + 60 * 60 * 1000;
      router.push(`/checkout/${invoiceId}#sui-${amount.toFixed(2)}-${expires}`);
      return;
    }
    const { commonBody, form } = buildOrderPayload();
    const token =
      paymentMethod === "crypto" && paymentSubOption === "crust"
        ? "crust"
        : paymentMethod === "crypto" && paymentSubOption === "pump"
          ? "pump"
          : paymentMethod === "crypto" && paymentSubOption === "troll"
            ? "troll"
            : paymentMethod === "crypto" && paymentSubOption === "soluna"
              ? "soluna"
              : paymentMethod === "crypto" && paymentSubOption === "seeker"
                ? "seeker"
                : paymentMethod === "crypto" && paymentSubOption === "cult"
                  ? "cult"
                  : paymentMethod === "stablecoins" &&
                      stablecoinToken === "usdc" &&
                      paymentSubOption === "solana"
                    ? "usdc"
                    : "solana";
    try {
      const createRes = await fetch("/api/checkout/solana-pay/create-order", {
        body: JSON.stringify({
          ...commonBody,
          shipping: form
            ? {
                address1: form.street,
                address2: form.apartment,
                city: form.city,
                countryCode: form.country,
                name: `${form.firstName} ${form.lastName}`.trim(),
                phone: form.phone,
                stateCode: form.state,
                zip: form.zip,
              }
            : undefined,
          token,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!createRes.ok) {
        setNavigatingToPay(false);
        const body = (await createRes.json().catch(() => ({}))) as {
          error?: string;
          retryAfter?: number;
        };
        const message =
          createRes.status === 429
            ? "Too many requests. Please wait a moment and try again."
            : body?.error || "Could not create order. Please try again.";
        setValidationErrors([message]);
        return;
      }
      const data = (await createRes.json()) as {
        confirmationToken?: string;
        orderId: string;
      };
      if (data.confirmationToken) {
        try {
          sessionStorage.setItem(
            `checkout_ct_${data.orderId}`,
            data.confirmationToken,
          );
        } catch {}
      }
      router.push(`/checkout/${data.orderId}`);
    } catch {
      setNavigatingToPay(false);
      setValidationErrors(["Could not create order. Please try again."]);
    }
  }, [
    validateForPayment,
    buildOrderPayload,
    paymentMethod,
    paymentSubOption,
    cryptoOtherSubOption,
    stablecoinToken,
    total,
    router,
    shippingFormRef,
    setNavigatingToPay,
    setValidationErrors,
  ]);

  const handleCardPayment = useCallback(async () => {
    await stripeCardRef.current?.submit();
  }, []);

  const handleGoToBtcPay = useCallback(async () => {
    if (!validateForPayment()) return;
    prefetchBtcPayClient();
    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();
    const { commonBody, form } = buildOrderPayload();
    const token =
      paymentSubOption === "bitcoin"
        ? "bitcoin"
        : paymentSubOption === "dogecoin"
          ? "doge"
          : "monero";
    try {
      const createRes = await fetch("/api/checkout/btcpay/create-order", {
        body: JSON.stringify({
          ...commonBody,
          shipping: form
            ? {
                address1: form.street,
                address2: form.apartment,
                city: form.city,
                countryCode: form.country,
                name: `${form.firstName} ${form.lastName}`.trim(),
                phone: form.phone,
                stateCode: form.state,
                zip: form.zip,
              }
            : undefined,
          token,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!createRes.ok) {
        setNavigatingToPay(false);
        const body = (await createRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setValidationErrors([
          body?.error || "Could not create order. Please try again.",
        ]);
        return;
      }
      const data = (await createRes.json()) as {
        confirmationToken?: string;
        orderId: string;
      };
      if (data.confirmationToken) {
        try {
          sessionStorage.setItem(
            `checkout_ct_${data.orderId}`,
            data.confirmationToken,
          );
        } catch {}
      }
      router.push(`/checkout/${data.orderId}`);
    } catch {
      setNavigatingToPay(false);
      setValidationErrors(["Could not create order. Please try again."]);
    }
  }, [
    validateForPayment,
    buildOrderPayload,
    paymentSubOption,
    router,
    shippingFormRef,
    setNavigatingToPay,
    setValidationErrors,
  ]);

  const handleGoToEthPay = useCallback(async () => {
    if (!validateForPayment()) return;
    prefetchEthPayClient();
    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();
    const chain =
      paymentMethod === "crypto"
        ? paymentSubOption === "eth"
          ? cryptoEthChain
          : "ethereum"
        : paymentMethod === "stablecoins"
          ? paymentSubOption
          : "ethereum";
    const token =
      paymentMethod === "crypto"
        ? "eth"
        : paymentMethod === "stablecoins" && stablecoinToken === "usdc"
          ? "usdc"
          : "usdt";
    const { commonBody, form } = buildOrderPayload();
    try {
      const res = await fetch("/api/checkout/eth-pay/create-order", {
        body: JSON.stringify({
          ...commonBody,
          chain,
          shipping: form
            ? {
                address1: form.street,
                address2: form.apartment,
                city: form.city,
                countryCode: form.country,
                name: `${form.firstName} ${form.lastName}`.trim(),
                phone: form.phone,
                stateCode: form.state,
                zip: form.zip,
              }
            : undefined,
          token,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create order");
      }
      const { confirmationToken, orderId } = (await res.json()) as {
        confirmationToken?: string;
        orderId: string;
      };
      if (confirmationToken) {
        try {
          sessionStorage.setItem(`checkout_ct_${orderId}`, confirmationToken);
        } catch {}
      }
      router.push(`/checkout/${orderId}`);
    } catch (err) {
      console.error("ETH order creation error:", err);
      setNavigatingToPay(false);
      setValidationErrors([
        err instanceof Error
          ? err.message
          : "Could not create order. Please try again.",
      ]);
    }
  }, [
    validateForPayment,
    buildOrderPayload,
    paymentMethod,
    paymentSubOption,
    stablecoinToken,
    cryptoEthChain,
    router,
    shippingFormRef,
    setNavigatingToPay,
    setValidationErrors,
  ]);

  const handleGoToTonPay = useCallback(async () => {
    if (!validateForPayment()) return;
    prefetchTonPayClient();
    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();
    const { commonBody, form } = buildOrderPayload();
    try {
      const createRes = await fetch("/api/checkout/ton-pay/create-order", {
        body: JSON.stringify({
          ...commonBody,
          shipping: form
            ? {
                address1: form.street,
                address2: form.apartment,
                city: form.city,
                countryCode: form.country,
                name: `${form.firstName} ${form.lastName}`.trim(),
                phone: form.phone,
                stateCode: form.state,
                zip: form.zip,
              }
            : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!createRes.ok) {
        setNavigatingToPay(false);
        const body = (await createRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setValidationErrors([
          body?.error || "Could not create order. Please try again.",
        ]);
        return;
      }
      const data = (await createRes.json()) as {
        confirmationToken?: string;
        orderId: string;
      };
      if (data.confirmationToken) {
        try {
          sessionStorage.setItem(
            `checkout_ct_${data.orderId}`,
            data.confirmationToken,
          );
        } catch {}
      }
      router.push(`/checkout/${data.orderId}`);
    } catch {
      setNavigatingToPay(false);
      setValidationErrors(["Could not create order. Please try again."]);
    }
  }, [
    validateForPayment,
    buildOrderPayload,
    router,
    shippingFormRef,
    setNavigatingToPay,
    setValidationErrors,
  ]);

  return (
    <>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Payment</CardTitle>
          <CardDescription>
            All transactions are secure and encrypted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ExpressCheckout
            buildOrderPayload={buildOrderPayload}
            setNavigatingToPay={setNavigatingToPay}
            setValidationErrors={setValidationErrors}
            shippingFormRef={shippingFormRef}
            stripeEnabled={PAYMENT_CONFIG.stripeEnabled}
            totalCents={totalCents}
          />
          {PAYMENT_CONFIG.stripeEnabled && totalCents > 0 && (
            <div
              className={`
              flex items-center gap-2 text-sm text-muted-foreground
            `}
            >
              <span aria-hidden className="flex-1 border-t border-border" />
              <span>Or pay with</span>
              <span aria-hidden className="flex-1 border-t border-border" />
            </div>
          )}
          {!hiddenOptions.creditCard && (
            <div className="space-y-0">
              <label
                className={paymentOptionRowClass}
                onFocus={() => preloadStripe()}
                onMouseEnter={() => preloadStripe()}
              >
                <div className="flex items-center gap-3">
                  <input
                    checked={paymentMethod === "credit-card"}
                    className={`
                      size-4 border-input text-primary
                      focus:ring-primary
                    `}
                    name="payment"
                    onChange={() => setPaymentTop("credit-card")}
                    type="radio"
                  />
                  <span className="text-sm font-medium">Credit/debit card</span>
                </div>
                <div className="flex items-center gap-2">
                  <Image
                    alt="Visa"
                    className="h-5 w-7 object-contain"
                    height={20}
                    src="/payments/visa.svg"
                    width={28}
                  />
                  <Image
                    alt="Mastercard"
                    className="h-5 w-7 object-contain"
                    height={20}
                    src="/payments/mastercard.svg"
                    width={28}
                  />
                  <Image
                    alt="Amex"
                    className="h-5 w-7 object-contain"
                    height={20}
                    src="/payments/amex.svg"
                    width={28}
                  />
                  <Popover onOpenChange={setCardLogosOpen} open={cardLogosOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className={`
                          rounded px-1.5 py-0.5 text-xs font-medium
                          text-muted-foreground
                          hover:bg-muted hover:text-foreground
                          focus-visible:ring-2 focus-visible:ring-ring
                          focus-visible:outline-none
                        `}
                        onMouseEnter={() => {
                          if (cardLogosCloseTimeoutRef.current) {
                            clearTimeout(cardLogosCloseTimeoutRef.current);
                            cardLogosCloseTimeoutRef.current = null;
                          }
                          setCardLogosOpen(true);
                        }}
                        onMouseLeave={() => {
                          cardLogosCloseTimeoutRef.current = setTimeout(
                            () => setCardLogosOpen(false),
                            150,
                          );
                        }}
                        type="button"
                      >
                        +2
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className={`
                        flex w-auto gap-2 bg-popover py-2
                        text-popover-foreground
                      `}
                      onMouseEnter={() => {
                        if (cardLogosCloseTimeoutRef.current) {
                          clearTimeout(cardLogosCloseTimeoutRef.current);
                          cardLogosCloseTimeoutRef.current = null;
                        }
                        setCardLogosOpen(true);
                      }}
                      onMouseLeave={() => setCardLogosOpen(false)}
                    >
                      <Image
                        alt="Discover"
                        className="h-5 w-7 object-contain"
                        height={20}
                        src="/payments/discover.svg"
                        width={28}
                      />
                      <Image
                        alt="Diners"
                        className="h-5 w-7 object-contain"
                        height={20}
                        src="/payments/diners.svg"
                        width={28}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </label>
              {paymentMethod === "credit-card" && (
                <div className="space-y-3 border-t border-border px-3 pt-4 pb-3">
                  <StripeCardPayment
                    billingFormRef={billingFormRef}
                    buildOrderPayload={buildOrderPayload}
                    ref={stripeCardRef}
                    setNavigatingToPay={setNavigatingToPay}
                    setValidationErrors={setValidationErrors}
                    shippingFormRef={shippingFormRef}
                    totalCents={totalCents}
                  />
                  <BillingAddressForm
                    countryOptions={countryOptions}
                    ref={billingFormRef}
                    shippingFormRef={shippingFormRef}
                    validationErrors={validationErrors}
                  />
                </div>
              )}
            </div>
          )}
          {/* Crypto row - full JSX continues in next message to avoid length limit */}
          {showCryptoRow && (
            <div className="space-y-0">
              <label className={paymentOptionRowClass}>
                <div className="flex items-center gap-3">
                  <input
                    checked={paymentMethod === "crypto"}
                    className={`
                      size-4 border-input text-primary
                      focus:ring-primary
                    `}
                    name="payment"
                    onChange={() => setPaymentTop("crypto")}
                    type="radio"
                  />
                  <span className="text-sm font-medium">Crypto</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {cryptoRowIcons.map((icon) => (
                    <Image
                      alt={icon.alt}
                      className="size-5 shrink-0 object-contain"
                      height={20}
                      key={icon.alt}
                      src={icon.src}
                      width={20}
                    />
                  ))}
                </div>
              </label>
              {paymentMethod === "crypto" && (
                <div className="space-y-2 border-t border-border px-3 pt-4 pb-3">
                  {visibleCryptoSubOptions.map((opt) => (
                    <div key={opt.value}>
                      <label
                        className={`
                        flex cursor-pointer items-center gap-3 rounded-md border
                        border-border p-2.5
                        has-[:checked]:border-primary has-[:checked]:ring-1
                        has-[:checked]:ring-primary/20
                      `}
                      >
                        <input
                          checked={paymentSubOption === opt.value}
                          className={`
                            size-4 border-input text-primary
                            focus:ring-primary
                          `}
                          name="payment-crypto"
                          onChange={() => {
                            setPaymentSubOption(opt.value as CryptoSub);
                            setValidationErrors([]);
                            if (opt.value !== "other")
                              setCryptoOtherSubOption("");
                          }}
                          type="radio"
                        />
                        <span className="text-sm">{opt.label}</span>
                        {CRYPTO_LOGO_SRC[
                          opt.value as keyof typeof CRYPTO_LOGO_SRC
                        ] && (
                          <Image
                            alt={opt.label}
                            className="ml-auto h-7 w-9 shrink-0 object-contain"
                            height={28}
                            src={
                              CRYPTO_LOGO_SRC[
                                opt.value as keyof typeof CRYPTO_LOGO_SRC
                              ]!
                            }
                            width={36}
                          />
                        )}
                      </label>
                      {opt.value === "eth" && paymentSubOption === "eth" && (
                        <div
                          className={`
                          mt-2 ml-5 space-y-2 border-l-2 border-muted pl-4
                        `}
                        >
                          {ETH_CHAIN_OPTIONS.map((chainOpt) => (
                            <label
                              className={`
                                flex cursor-pointer items-center gap-3
                                rounded-md border border-border p-2.5
                                has-[:checked]:border-primary
                                has-[:checked]:ring-1
                                has-[:checked]:ring-primary/20
                              `}
                              key={chainOpt.value}
                            >
                              <input
                                checked={cryptoEthChain === chainOpt.value}
                                className={`
                                  size-4 border-input text-primary
                                  focus:ring-primary
                                `}
                                name="payment-crypto-eth-chain"
                                onChange={() => {
                                  setCryptoEthChain(chainOpt.value);
                                  setValidationErrors([]);
                                }}
                                type="radio"
                              />
                              <span className="text-sm">{chainOpt.label}</span>
                              <Image
                                alt={chainOpt.label}
                                className={`
                                  ml-auto h-7 w-9 shrink-0 object-contain
                                `}
                                height={28}
                                src="/crypto/ethereum/ethereum-logo.svg"
                                width={36}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                      {opt.value === "other" &&
                        paymentSubOption === "other" && (
                          <div
                            className={`
                            mt-2 ml-5 space-y-2 border-l-2 border-muted pl-4
                          `}
                          >
                            {OTHER_SUB_OPTIONS.map((otherOpt) => (
                              <label
                                className={`
                                  flex cursor-pointer items-center gap-3
                                  rounded-md border border-border p-2.5
                                  has-[:checked]:border-primary
                                  has-[:checked]:ring-1
                                  has-[:checked]:ring-primary/20
                                `}
                                key={otherOpt.value}
                              >
                                <input
                                  checked={
                                    cryptoOtherSubOption === otherOpt.value
                                  }
                                  className={`
                                    size-4 border-input text-primary
                                    focus:ring-primary
                                  `}
                                  name="payment-crypto-other"
                                  onChange={() => {
                                    setCryptoOtherSubOption(otherOpt.value);
                                    setValidationErrors([]);
                                  }}
                                  type="radio"
                                />
                                <span className="text-sm">
                                  {otherOpt.label}
                                </span>
                                {CRYPTO_LOGO_SRC[otherOpt.value] && (
                                  <Image
                                    alt={otherOpt.label}
                                    className={`
                                      ml-auto h-7 w-9 shrink-0 object-contain
                                    `}
                                    height={28}
                                    src={CRYPTO_LOGO_SRC[otherOpt.value]!}
                                    width={36}
                                  />
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {showStablecoinsRow && (
            <div className="space-y-0">
              <label className={paymentOptionRowClass}>
                <div className="flex items-center gap-3">
                  <input
                    checked={paymentMethod === "stablecoins"}
                    className={`
                      size-4 border-input text-primary
                      focus:ring-primary
                    `}
                    name="payment"
                    onChange={() => setPaymentTop("stablecoins")}
                    type="radio"
                  />
                  <span className="text-sm font-medium">
                    Stablecoins (
                    {showUsdcOption && showUsdtOption
                      ? "USDC / USDT"
                      : showUsdcOption
                        ? "USDC"
                        : "USDT"}
                    )
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {showUsdcOption && (
                    <Image
                      alt="USDC"
                      className="size-5 shrink-0 object-contain"
                      height={20}
                      src={STABLECOIN_TOKEN_LOGO.usdc}
                      width={20}
                    />
                  )}
                  {showUsdtOption && (
                    <Image
                      alt="USDT"
                      className="size-5 shrink-0 object-contain"
                      height={20}
                      src={STABLECOIN_TOKEN_LOGO.usdt}
                      width={20}
                    />
                  )}
                </div>
              </label>
              {paymentMethod === "stablecoins" && (
                <div className="space-y-3 border-t border-border px-3 pt-4 pb-3">
                  <div className="flex gap-2">
                    {showUsdcOption && (
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          checked={stablecoinToken === "usdc"}
                          className={`
                            size-4 border-input text-primary
                            focus:ring-primary
                          `}
                          name="stablecoin-token"
                          onChange={() => {
                            setStablecoinToken("usdc");
                            setPaymentSubOption("solana" as UsdcSub);
                          }}
                          type="radio"
                        />
                        <Image
                          alt="USDC"
                          className="h-5 w-5 shrink-0 object-contain"
                          height={20}
                          src={STABLECOIN_TOKEN_LOGO.usdc}
                          width={20}
                        />
                        <span className="text-sm">USDC</span>
                      </label>
                    )}
                    {showUsdtOption && (
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          checked={stablecoinToken === "usdt"}
                          className={`
                            size-4 border-input text-primary
                            focus:ring-primary
                          `}
                          name="stablecoin-token"
                          onChange={() => {
                            setStablecoinToken("usdt");
                            setPaymentSubOption("ethereum" as UsdtSub);
                          }}
                          type="radio"
                        />
                        <Image
                          alt="USDT"
                          className="h-5 w-5 shrink-0 object-contain"
                          height={20}
                          src={STABLECOIN_TOKEN_LOGO.usdt}
                          width={20}
                        />
                        <span className="text-sm">USDT</span>
                      </label>
                    )}
                  </div>
                  {stablecoinToken === "usdc" &&
                    visibleUsdcSubOptions.map((opt) => (
                      <label
                        className={`
                          flex cursor-pointer items-center gap-3 rounded-md
                          border border-border p-2.5
                          has-[:checked]:border-primary has-[:checked]:ring-1
                          has-[:checked]:ring-primary/20
                        `}
                        key={opt.value}
                      >
                        <input
                          checked={paymentSubOption === opt.value}
                          className={`
                            size-4 border-input text-primary
                            focus:ring-primary
                          `}
                          name="usdc-network"
                          onChange={() =>
                            setPaymentSubOption(opt.value as UsdcSub)
                          }
                          type="radio"
                        />
                        <span className="text-sm">{opt.label}</span>
                        <Image
                          alt={opt.label}
                          className="ml-auto h-7 w-9 shrink-0 object-contain"
                          height={28}
                          src={
                            STABLECOIN_CHAIN_LOGO[
                              opt.value as keyof typeof STABLECOIN_CHAIN_LOGO
                            ]
                          }
                          width={36}
                        />
                      </label>
                    ))}
                  {stablecoinToken === "usdt" &&
                    visibleUsdtSubOptions.map((opt) => (
                      <label
                        className={`
                          flex cursor-pointer items-center gap-3 rounded-md
                          border border-border p-2.5
                          has-[:checked]:border-primary has-[:checked]:ring-1
                          has-[:checked]:ring-primary/20
                        `}
                        key={opt.value}
                      >
                        <input
                          checked={paymentSubOption === opt.value}
                          className={`
                            size-4 border-input text-primary
                            focus:ring-primary
                          `}
                          name="usdt-network"
                          onChange={() =>
                            setPaymentSubOption(opt.value as UsdtSub)
                          }
                          type="radio"
                        />
                        <span className="text-sm">{opt.label}</span>
                        <Image
                          alt={opt.label}
                          className="ml-auto h-7 w-9 shrink-0 object-contain"
                          height={28}
                          src={
                            STABLECOIN_CHAIN_LOGO[
                              opt.value as keyof typeof STABLECOIN_CHAIN_LOGO
                            ]
                          }
                          width={36}
                        />
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}
          {/* PayPal: shown when Stripe is enabled; selectable only when paypalEnabled */}
          {PAYMENT_CONFIG.stripeEnabled && !hiddenOptions.paypal && (
            <div className="space-y-0">
              {PAYMENT_CONFIG.paypalEnabled ? (
                <label className={paymentOptionRowClass}>
                  <div className="flex items-center gap-3">
                    <input
                      checked={paymentMethod === "paypal"}
                      className={`
                        size-4 border-input text-primary
                        focus:ring-primary
                      `}
                      name="payment"
                      onChange={() => setPaymentTop("paypal")}
                      type="radio"
                    />
                    <span className="text-sm font-medium">Pay with PayPal</span>
                  </div>
                  <Image
                    alt="PayPal"
                    className="ml-auto h-6 w-16 shrink-0 object-contain"
                    height={24}
                    src="/payments/paypal.svg"
                    width={64}
                  />
                </label>
              ) : (
                <div aria-disabled="true" className={paymentOptionRowClass}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">
                      Pay with PayPal
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Enable in store settings
                    </span>
                  </div>
                  <Image
                    alt="PayPal"
                    className={`
                      ml-auto h-6 w-16 shrink-0 object-contain opacity-50
                    `}
                    height={24}
                    src="/payments/paypal.svg"
                    width={64}
                  />
                </div>
              )}
              {paymentMethod === "paypal" && PAYMENT_CONFIG.paypalEnabled && (
                <div className="space-y-3 border-t border-border px-3 pt-4 pb-3">
                  <div
                    className={`
                    flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2.5
                  `}
                  >
                    <Lock
                      aria-hidden
                      className="size-4 shrink-0 text-[#C4873A]"
                    />
                    <p className="text-sm text-muted-foreground">
                      You&apos;ll be securely redirected to complete your
                      purchase with PayPal.
                    </p>
                  </div>
                  <BillingAddressForm
                    countryOptions={countryOptions}
                    ref={billingFormRef}
                    shippingFormRef={shippingFormRef}
                    validationErrors={validationErrors}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {validationErrors.length > 0 && (
          <div
            className={`
              rounded-md border border-destructive/50 bg-destructive/10 px-4
              py-3 text-sm text-destructive
            `}
            role="alert"
          >
            <p className="font-medium">Please fix the following:</p>
            <ul className="mt-1 list-inside list-disc">
              {validationErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
        {paymentMethod === "credit-card" ? (
          (payHandlerRef.current = handleCardPayment),
          <Button
            className={paymentButtonClass}
            disabled={navigatingToPay}
            onClick={handleCardPayment}
            size="lg"
            type="button"
          >
            {navigatingToPay ? (
              <>
                <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                Securing your payment…
              </>
            ) : (
              <>
                <Lock aria-hidden className="mr-2 size-4" />
                Pay securely with card
              </>
            )}
          </Button>
        ) : paymentMethod === "paypal" && PAYMENT_CONFIG.paypalEnabled ? (
          (payHandlerRef.current = handlePlaceOrder),
          <Button
            className={paymentButtonClass}
            disabled={navigatingToPay}
            onClick={handlePlaceOrder}
            size="lg"
            type="button"
          >
            {navigatingToPay ? (
              <>
                <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                Redirecting to PayPal…
              </>
            ) : (
              <>
                <Image
                  alt=""
                  className="mr-2 h-5 w-6 object-contain"
                  height={20}
                  src="/payments/paypal.svg"
                  width={24}
                />
                Pay with PayPal
              </>
            )}
          </Button>
        ) : isBtcPaySupported ? (
          (payHandlerRef.current = handleGoToBtcPay),
          <Button
            className={paymentButtonClass}
            disabled={navigatingToPay}
            onClick={handleGoToBtcPay}
            size="lg"
            type="button"
          >
            {navigatingToPay ? (
              <>
                <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                Creating order…
              </>
            ) : paymentSubOption === "bitcoin" ? (
              "Pay with Bitcoin"
            ) : paymentSubOption === "dogecoin" ? (
              "Pay with Dogecoin"
            ) : (
              "Pay with Monero"
            )}
          </Button>
        ) : isEvmPaySupported ? (
          (payHandlerRef.current = handleGoToEthPay),
          <Button
            className={paymentButtonClass}
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToEthPay}
            size="lg"
            type="button"
          >
            {navigatingToPay ? (
              <>
                <Loader2 aria-hidden className="mr-2 size-4 animate-spin" />
                Creating order…
              </>
            ) : paymentMethod === "crypto" ? (
              `Pay with ETH (${cryptoEthChain === "ethereum" ? "Ethereum" : cryptoEthChain === "arbitrum" ? "Arbitrum" : cryptoEthChain === "base" ? "Base" : "Polygon"})`
            ) : paymentMethod === "stablecoins" &&
              stablecoinToken === "usdc" ? (
              `Pay with USDC (${paymentSubOption === "ethereum" ? "Ethereum" : paymentSubOption === "arbitrum" ? "Arbitrum" : paymentSubOption === "base" ? "Base" : "Polygon"})`
            ) : (
              `Pay with USDT (${paymentSubOption === "ethereum" ? "Ethereum" : paymentSubOption === "arbitrum" ? "Arbitrum" : paymentSubOption === "base" ? "Base" : paymentSubOption === "bnb" ? "BNB" : "Polygon"})`
            )}
          </Button>
        ) : isSolanaPaySupported ? (
          (payHandlerRef.current = handleGoToCryptoPay),
          <Button
            className={paymentButtonClass}
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToCryptoPay}
            size="lg"
            type="button"
          >
            {navigatingToPay
              ? "Redirecting…"
              : paymentMethod === "crypto" && paymentSubOption === "crust"
                ? "Pay with CRUST"
                : paymentMethod === "crypto" && paymentSubOption === "pump"
                  ? "Pay with Pump"
                  : paymentMethod === "crypto" && paymentSubOption === "troll"
                    ? "Pay with TROLL"
                    : paymentMethod === "crypto" &&
                        paymentSubOption === "soluna"
                      ? "Pay with SOLUNA"
                      : paymentMethod === "crypto" &&
                          paymentSubOption === "seeker"
                        ? "Pay with Seeker (SKR)"
                        : paymentMethod === "crypto" &&
                            paymentSubOption === "cult"
                          ? "Pay with CULT"
                          : paymentMethod === "stablecoins" &&
                            stablecoinToken === "usdc" &&
                            paymentSubOption === "solana"
                          ? "Pay with USDC (Solana)"
                          : "Pay with Solana"}
          </Button>
        ) : isSuiPaySupported ? (
          (payHandlerRef.current = handleGoToCryptoPay),
          <Button
            className={paymentButtonClass}
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToCryptoPay}
            size="lg"
            type="button"
          >
            {navigatingToPay ? "Redirecting…" : "Pay with SUI"}
          </Button>
        ) : isTonPaySupported ? (
          (payHandlerRef.current = handleGoToTonPay),
          <Button
            className={paymentButtonClass}
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToTonPay}
            size="lg"
            type="button"
          >
            {navigatingToPay ? "Redirecting…" : "Pay with TON"}
          </Button>
        ) : paymentMethod === "" ? (
          (payHandlerRef.current = () => {}),
          <p
            className={`
            rounded-md border border-border bg-muted/50 px-4 py-3.5 text-base
            text-muted-foreground
          `}
          >
            Select a payment method above.
          </p>
        ) : paymentMethod === "crypto" && paymentSubOption === "" ? (
          (payHandlerRef.current = () => {}),
          <p
            className={`
            rounded-md border border-border bg-muted/50 px-4 py-3 text-sm
            text-muted-foreground
          `}
          >
            Select a crypto option above (e.g. Ethereum, Solana, Crustafarian).
          </p>
        ) : paymentMethod === "stablecoins" ? (
          (payHandlerRef.current = () => {}),
          <p
            className={`
            rounded-md border border-border bg-muted/50 px-4 py-3 text-sm
            text-muted-foreground
          `}
          >
            Select USDC or USDT and a network above.
          </p>
        ) : (
          (payHandlerRef.current = () => {}),
          <p
            className={`
            rounded-md border border-border bg-muted/50 px-4 py-3 text-sm
            text-muted-foreground
          `}
          >
            This payment option is not available yet. Use Credit/debit card,
            Crypto, Stablecoins (USDC/USDT), or PayPal.
          </p>
        )}
        {/* Reassurance messaging */}
        <div
          className={`
          flex flex-col gap-2.5 rounded-md border border-[#C4873A]/20
          bg-[#C4873A]/5 px-4 py-3.5
        `}
        >
          <div className="flex items-center gap-2.5 text-base text-[#C4873A]">
            <svg
              aria-hidden
              className="size-5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="font-medium">30-day money-back guarantee</span>
          </div>
          <div className="flex items-center gap-2.5 text-base text-[#C4873A]">
            <svg
              aria-hidden
              className="size-5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>Secure, encrypted transactions</span>
          </div>
          <div className="flex items-center gap-2.5 text-base text-[#C4873A]">
            <svg
              aria-hidden
              className="size-5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Customer support available 7 days a week</span>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <p
            className={`
            flex flex-wrap items-center justify-center gap-x-2 gap-y-1
            text-center text-sm text-muted-foreground
          `}
          >
            <PolicyPopup
              fullPolicyHref="/policies/refund"
              richContent={
                <div className="space-y-3">
                  <div
                    className={`
                    flex items-center gap-2 rounded-md bg-[#C4873A]/10 px-3 py-2
                  `}
                  >
                    <svg
                      aria-hidden
                      className="size-4 shrink-0 text-[#C4873A]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span className="text-sm font-medium text-[#C4873A]">
                      30-day money-back guarantee on all orders
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Return any item within{" "}
                      <strong>30 days of delivery</strong> for a full refund
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Items must be unworn/unused, with tags and original
                      packaging
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Contact us first and we&apos;ll provide a{" "}
                      <strong>free return label</strong>
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Refunds processed within <strong>10 business days</strong>{" "}
                      after inspection
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      EU/UK customers: 14-day right to cancel for any reason
                    </li>
                  </ul>
                  {hasEsimInCart ? (
                    <>
                      <div className="border-t border-border pt-3">
                        <p className="mb-2 text-sm font-medium text-foreground">
                          eSIM plans (in your cart)
                        </p>
                        <ul
                          className={`
                          space-y-1.5 text-sm text-muted-foreground
                        `}
                        >
                          {ESIM_REFUND_POPUP_ITEMS.map((item, i) => (
                            <li className="flex items-start gap-2" key={i}>
                              <span
                                aria-hidden
                                className={`
                                  mt-1 block size-1.5 shrink-0 rounded-full
                                  bg-amber-500/60
                                `}
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    We want you to love your purchase. If something isn&apos;t
                    right, we&apos;ll make it right.
                  </p>
                </div>
              }
              title="Refund policy"
            >
              Refund policy
            </PolicyPopup>
            <span aria-hidden>·</span>
            <PolicyPopup
              fullPolicyHref="/policies/shipping"
              richContent={
                <div className="space-y-3">
                  <div
                    className={`
                    flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2
                    dark:bg-blue-950/30
                  `}
                  >
                    <svg
                      aria-hidden
                      className={`
                        size-4 shrink-0 text-blue-600
                        dark:text-blue-400
                      `}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11" />
                      <path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2" />
                      <circle cx="7" cy="18" r="2" />
                      <path d="M15 18H9" />
                      <circle cx="17" cy="18" r="2" />
                    </svg>
                    <span
                      className={`
                      text-sm font-medium text-blue-700
                      dark:text-blue-400
                    `}
                    >
                      Most orders ship within 1 business day
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      <strong>Domestic (US):</strong> 2–4 business days delivery
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      <strong>International:</strong> 5–14 business days
                      delivery
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Tracking number sent via email once shipped
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Peak seasons may add up to 1 week
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    We partner with multiple fulfillment centers to get your
                    order to you as quickly as possible. P.O. Boxes are not
                    supported.
                  </p>
                </div>
              }
              title="Shipping policy"
            >
              Shipping policy
            </PolicyPopup>
            <span aria-hidden>·</span>
            <PolicyPopup
              fullPolicyHref="/policies/privacy"
              richContent={
                <div className="space-y-3">
                  <div
                    className={`
                    flex items-center gap-2 rounded-md bg-purple-50 px-3 py-2
                    dark:bg-purple-950/30
                  `}
                  >
                    <svg
                      aria-hidden
                      className={`
                        size-4 shrink-0 text-purple-600
                        dark:text-purple-400
                      `}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <rect height="11" rx="2" ry="2" width="18" x="3" y="11" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span
                      className={`
                      text-sm font-medium text-purple-700
                      dark:text-purple-400
                    `}
                    >
                      We never sell your data
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      We collect only what&apos;s needed to fulfill your order
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      <strong>No targeted advertising</strong> — your data stays
                      between us
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Only essential cookies (sign-in, cart, security)
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      You can access, correct, delete, or export your data
                      anytime
                    </li>
                  </ul>
                  <p className="text-sm text-muted-foreground">
                    Your privacy is a right, not a privilege. We protect it
                    accordingly.
                  </p>
                </div>
              }
              title="Privacy policy"
            >
              Privacy policy
            </PolicyPopup>
            <span aria-hidden>·</span>
            <PolicyPopup
              fullPolicyHref="/policies/terms"
              richContent={
                <div className="space-y-3">
                  <p className="text-sm">
                    By completing your purchase you agree to these terms and our
                    Privacy, Refund, and Shipping policies.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      You must be the age of majority in your jurisdiction
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      We may correct pricing errors or limit order quantities
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Questions? Contact us first — we&apos;re happy to help
                      resolve any issue
                    </li>
                    <li className="flex items-start gap-2">
                      <span
                        className={`
                        mt-1 block size-1.5 shrink-0 rounded-full
                        bg-foreground/40
                      `}
                      />
                      Governing law: United States
                    </li>
                  </ul>
                </div>
              }
              title="Terms of service"
            >
              Terms of service
            </PolicyPopup>
          </p>
        </div>
      </div>

      <SolanaPayDialog
        amountUsd={solanaPayAmountUsd}
        onOpenChange={(open) => !open && closeSolanaPayDialog()}
        open={solanaPayOpen}
        orderId={solanaPayOrderId ?? undefined}
        paymentUrl={solanaPayPaymentUrl}
        recipientAddress={solanaPayRecipientAddress ?? undefined}
        status={solanaPayStatus}
        tokenSymbol="USDC"
      />
    </>
  );
});
