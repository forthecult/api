"use client";

import {
  createQR,
  encodeURL,
} from "@solana/pay";
import { PublicKey } from "@solana/web3-compat";
import Image from "next/image";
import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type BigNumber from "bignumber.js";

import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";
import {
  getHiddenFromVisibility,
  hasAnyCryptoEnabled,
  hasAnyStablecoinEnabled,
  visibleCryptoSubFromVisibility,
  visibleUsdcNetworks,
  visibleUsdtNetworks,
} from "~/lib/checkout-payment-options";
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
import { Input } from "~/ui/primitives/input";
import { cn } from "~/lib/cn";
import type { OrderPayload } from "../checkout-shared";
import {
  checkoutFieldHeight,
  paymentButtonClass,
  paymentOptionRowClass,
  REFUND_POLICY_SUMMARY,
  PRIVACY_POLICY_SUMMARY,
  TERMS_POLICY_SUMMARY,
  SHIPPING_POLICY_CONTENT,
} from "../checkout-shared";
import {
  BillingAddressForm,
  type BillingAddressFormRef,
} from "./BillingAddressForm";
import { PolicyPopup } from "./PolicyPopup";
import { SolanaPayDialog } from "./solana-pay-dialog";
import { useSolanaPayCheckout } from "../hooks/useSolanaPayCheckout";
import {
  CRYPTO_LOGO_SRC,
  ETH_CHAIN_OPTIONS,
  HIDDEN_PAYMENT_OPTIONS,
  INITIAL_CRYPTO_SUB,
  OTHER_SUB_OPTIONS,
  USDC_SUB_OPTIONS,
  USDT_SUB_OPTIONS,
  VISIBLE_CRYPTO_SUB_OPTIONS,
} from "../checkout-payment-constants";
import type { ShippingAddressFormRef } from "./ShippingAddressForm";

type PaymentMethodTop =
  | "credit-card"
  | "crypto"
  | "stablecoins"
  | "paypal";
type CryptoSub =
  | "bitcoin"
  | "dogecoin"
  | "eth"
  | "solana"
  | "monero"
  | "crust"
  | "pump"
  | "other";
type UsdcSub = "solana" | "ethereum" | "arbitrum" | "base" | "polygon";
type UsdtSub = "ethereum" | "arbitrum" | "bnb" | "polygon";

const EVM_CHAINS = ["ethereum", "arbitrum", "base", "polygon"] as const;
const EVM_CHAINS_AND_BNB = [
  "ethereum",
  "arbitrum",
  "base",
  "polygon",
  "bnb",
] as const;

export interface PaymentMethodSectionProps {
  buildOrderPayload: () => OrderPayload;
  shippingFormRef: React.RefObject<ShippingAddressFormRef | null>;
  billingFormRef: React.RefObject<BillingAddressFormRef | null>;
  total: number;
  canShipToCountry: boolean;
  countryOptions: { value: string; label: string }[];
  validationErrors: string[];
  setValidationErrors: (errors: string[]) => void;
  navigatingToPay: boolean;
  setNavigatingToPay: (v: boolean) => void;
  onCryptoTotalLabelChange?: (label: string | null) => void;
}

export function PaymentMethodSection({
  buildOrderPayload,
  shippingFormRef,
  billingFormRef,
  total,
  canShipToCountry,
  countryOptions,
  validationErrors,
  setValidationErrors,
  navigatingToPay,
  setNavigatingToPay,
  onCryptoTotalLabelChange,
}: PaymentMethodSectionProps) {
  const router = useRouter();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodTop | "">("");
  const [stablecoinToken, setStablecoinToken] = useState<"usdc" | "usdt">("usdc");
  const [paymentSubOption, setPaymentSubOption] = useState<
    CryptoSub | UsdcSub | UsdtSub | ""
  >(INITIAL_CRYPTO_SUB);
  const [cryptoOtherSubOption, setCryptoOtherSubOption] = useState<
    "sui" | "ton" | ""
  >("");
  const [cryptoEthChain, setCryptoEthChain] = useState<
    "ethereum" | "arbitrum" | "base" | "polygon"
  >("ethereum");
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    cardName: "",
  });
  const [cardLogosOpen, setCardLogosOpen] = useState(false);
  const cardLogosCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const {
    open: solanaPayOpen,
    openDialog: openSolanaPayDialog,
    closeDialog: closeSolanaPayDialog,
    paymentUrl: solanaPayPaymentUrl,
    status: solanaPayStatus,
    orderId: solanaPayOrderId,
    amountUsd: solanaPayAmountUsd,
    recipientAddress: solanaPayRecipientAddress,
  } = useSolanaPayCheckout({
    buildOrderPayload,
    total,
  });

  const [cryptoPrices, setCryptoPrices] = useState<{
    SOL?: number;
    CRUST?: number;
    PUMP?: number;
  }>({});

  const { visibility } = usePaymentMethodSettings();
  const hiddenOptions = useMemo(
    () =>
      visibility
        ? getHiddenFromVisibility(visibility)
        : HIDDEN_PAYMENT_OPTIONS,
    [visibility],
  );
  const solanaPayConfigured = Boolean(getSolanaPayRecipient());

  useEffect(() => {
    if (paymentMethod !== "crypto") return;
    fetch("/api/crypto/prices")
      .then((res) => res.json())
      .then((data: { SOL?: number; CRUST?: number; PUMP?: number }) => {
        if (data && typeof data === "object") setCryptoPrices(data);
      })
      .catch(() => {});
  }, [paymentMethod]);

  const visibleCryptoSubOptions = useMemo(() => {
    const base = visibility
      ? visibleCryptoSubFromVisibility(visibility)
      : VISIBLE_CRYPTO_SUB_OPTIONS;
    return base.filter(
      (opt) => opt.value !== "solana" || solanaPayConfigured,
    );
  }, [visibility, solanaPayConfigured]);
  const showCryptoRow =
    visibility === null || hasAnyCryptoEnabled(visibility);
  const showStablecoinsRow =
    visibility === null || hasAnyStablecoinEnabled(visibility);
  const visibleUsdcSubOptions = useMemo(() => {
    const base =
      visibility !== null
        ? visibleUsdcNetworks(visibility)
        : USDC_SUB_OPTIONS;
    return base.filter(
      (opt) => opt.value !== "solana" || solanaPayConfigured,
    );
  }, [visibility, solanaPayConfigured]);
  const visibleUsdtSubOptions = useMemo(
    () =>
      visibility !== null
        ? visibleUsdtNetworks(visibility)
        : USDT_SUB_OPTIONS,
    [visibility],
  );

  const isSolanaPaySupported =
    solanaPayConfigured &&
    ((paymentMethod === "stablecoins" &&
      stablecoinToken === "usdc" &&
      paymentSubOption === "solana") ||
      (paymentMethod === "crypto" && paymentSubOption === "crust") ||
      (paymentMethod === "crypto" && paymentSubOption === "pump") ||
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
    if (paymentMethod !== "crypto" || total <= 0) return null;
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
    return null;
  }, [
    paymentMethod,
    paymentSubOption,
    total,
    cryptoPrices.SOL,
    cryptoPrices.CRUST,
    cryptoPrices.PUMP,
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

  const validateCreditCard = useCallback((): string[] => {
    const err: string[] = [];
    if (!cardForm.cardNumber?.trim()) err.push("Card number is required");
    if (!cardForm.cardExpiry?.trim()) err.push("Expiry (MM/YY) is required");
    if (!cardForm.cardCvc?.trim()) err.push("CVC is required");
    if (!cardForm.cardName?.trim()) err.push("Name on card is required");
    return err;
  }, [
    cardForm.cardNumber,
    cardForm.cardExpiry,
    cardForm.cardCvc,
    cardForm.cardName,
  ]);

  const setPaymentTop = useCallback((method: PaymentMethodTop) => {
    setPaymentMethod(method);
    setValidationErrors([]);
    if (method === "crypto") {
      setPaymentSubOption("");
      setCryptoOtherSubOption("");
    } else if (method === "stablecoins") {
      setStablecoinToken("usdc");
      setPaymentSubOption("solana" as UsdcSub);
    }
  }, [setValidationErrors]);

  const handlePlaceOrder = useCallback(() => {
    const shippingErr = shippingFormRef.current?.validate() ?? [];
    const useShippingAsBillingVal =
      billingFormRef.current?.getUseShippingAsBilling() ?? true;
    const billingErr = !useShippingAsBillingVal
      ? (billingFormRef.current?.validate() ?? [])
      : [];
    const cardErr = paymentMethod === "credit-card" ? validateCreditCard() : [];
    const all = [...shippingErr, ...billingErr, ...cardErr];
    setValidationErrors(all);
    if (all.length === 0) {
      setNavigatingToPay(true);
      requestAnimationFrame(() => router.push("/checkout/success"));
    }
  }, [
    paymentMethod,
    shippingFormRef,
    billingFormRef,
    validateCreditCard,
    setValidationErrors,
    setNavigatingToPay,
    router,
  ]);

  const handlePayWithSolana = useCallback(() => {
    if (!validateForPayment()) return;
    shippingFormRef.current?.persistForm();
    openSolanaPayDialog();
  }, [validateForPayment, openSolanaPayDialog, shippingFormRef]);

  const handleGoToCryptoPay = useCallback(async () => {
    if (!validateForPayment()) return;
    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();
    const isSui =
      paymentMethod === "crypto" && cryptoOtherSubOption === "sui";
    if (isSui) {
      const invoiceId = crypto.randomUUID();
      const amount = total;
      const expires = Date.now() + 60 * 60 * 1000;
      router.push(`/checkout/${invoiceId}#sui-${amount.toFixed(2)}-${expires}`);
      return;
    }
    const { commonBody } = buildOrderPayload();
    try {
      const createRes = await fetch("/api/checkout/solana-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commonBody),
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
      const data = (await createRes.json()) as { orderId: string };
      const token =
        paymentMethod === "crypto" && paymentSubOption === "crust"
          ? "crust"
          : paymentMethod === "crypto" && paymentSubOption === "pump"
            ? "pump"
            : paymentMethod === "stablecoins" &&
                stablecoinToken === "usdc" &&
                paymentSubOption === "solana"
              ? "usdc"
              : "solana";
      router.push(`/checkout/${data.orderId}#${token}`);
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

  const handleGoToBtcPay = useCallback(async () => {
    if (!validateForPayment()) return;
    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();
    const { commonBody } = buildOrderPayload();
    const token =
      paymentSubOption === "bitcoin"
        ? "bitcoin"
        : paymentSubOption === "dogecoin"
          ? "doge"
          : "monero";
    try {
      const createRes = await fetch("/api/checkout/btcpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...commonBody, token }),
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
      const data = (await createRes.json()) as { orderId: string };
      router.push(`/checkout/${data.orderId}#${token}`);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...commonBody,
          chain,
          token,
          shipping: form
            ? {
                name: `${form.firstName} ${form.lastName}`.trim(),
                address1: form.street,
                address2: form.apartment,
                city: form.city,
                stateCode: form.state,
                countryCode: form.country,
                zip: form.zip,
                phone: form.phone,
              }
            : undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create order");
      }
      const { orderId } = await res.json();
      router.push(`/checkout/${orderId}#${token}`);
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
    setNavigatingToPay(true);
    shippingFormRef.current?.persistForm();
    const { commonBody } = buildOrderPayload();
    try {
      const createRes = await fetch("/api/checkout/ton-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commonBody),
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
      const data = (await createRes.json()) as { orderId: string };
      router.push(`/checkout/${data.orderId}#ton`);
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
          {!hiddenOptions.creditCard && (
            <div className="space-y-0">
              <label className={paymentOptionRowClass}>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "credit-card"}
                    onChange={() => setPaymentTop("credit-card")}
                    className="size-4 border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">
                    Credit/debit card
                  </span>
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
                  <Popover
                    onOpenChange={setCardLogosOpen}
                    open={cardLogosOpen}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                      className="flex w-auto gap-2 py-2 bg-popover text-popover-foreground"
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
                <div className="space-y-4 border-t border-border px-3 pb-3 pt-4">
                  <div className="relative">
                    <Input
                      aria-label="Card number"
                      aria-invalid={validationErrors.includes(
                        "Card number is required",
                      )}
                      className={cn(
                        checkoutFieldHeight,
                        "pr-10",
                        validationErrors.includes(
                          "Card number is required",
                        ) && "border-destructive",
                      )}
                      placeholder="Card number"
                      value={cardForm.cardNumber}
                      onChange={(e) =>
                        setCardForm((prev) => ({
                          ...prev,
                          cardNumber: e.target.value,
                        }))
                      }
                    />
                    <Lock
                      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      aria-label="Expiry (MM/YY)"
                      aria-invalid={validationErrors.includes(
                        "Expiry (MM/YY) is required",
                      )}
                      className={cn(
                        checkoutFieldHeight,
                        validationErrors.includes(
                          "Expiry (MM/YY) is required",
                        ) && "border-destructive",
                      )}
                      placeholder="MM/YY"
                      value={cardForm.cardExpiry}
                      onChange={(e) => {
                        const raw = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 4);
                        const formatted =
                          raw.length >= 2
                            ? `${raw.slice(0, 2)}/${raw.slice(2)}`
                            : raw;
                        setCardForm((prev) => ({
                          ...prev,
                          cardExpiry: formatted,
                        }));
                      }}
                    />
                    <Input
                      aria-label="CVC"
                      aria-invalid={validationErrors.includes(
                        "CVC is required",
                      )}
                      className={cn(
                        checkoutFieldHeight,
                        validationErrors.includes("CVC is required") &&
                          "border-destructive",
                      )}
                      placeholder="CVC"
                      value={cardForm.cardCvc}
                      onChange={(e) =>
                        setCardForm((prev) => ({
                          ...prev,
                          cardCvc: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Input
                    aria-label="Name on card"
                    aria-invalid={validationErrors.includes(
                      "Name on card is required",
                    )}
                    className={cn(
                      checkoutFieldHeight,
                      validationErrors.includes(
                        "Name on card is required",
                      ) && "border-destructive",
                    )}
                    placeholder="Name on card"
                    value={cardForm.cardName}
                    onChange={(e) =>
                      setCardForm((prev) => ({
                        ...prev,
                        cardName: e.target.value,
                      }))
                    }
                  />
                  <BillingAddressForm
                    ref={billingFormRef}
                    countryOptions={countryOptions}
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
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "crypto"}
                    onChange={() => setPaymentTop("crypto")}
                    className="size-4 border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Crypto</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!hiddenOptions.cryptoBitcoin && (
                    <Image
                      alt="Bitcoin"
                      className="size-5 shrink-0 object-contain"
                      height={20}
                      src="/crypto/bitcoin/bitcoin-logo.svg"
                      width={20}
                    />
                  )}
                  <Image
                    alt="Ethereum"
                    className="size-5 shrink-0 object-contain"
                    height={20}
                    src="/crypto/ethereum/ethereum-logo.svg"
                    width={20}
                  />
                  <Image
                    alt="Solana"
                    className="size-5 shrink-0 object-contain"
                    height={20}
                    src="/crypto/solana/solanaLogoMark.svg"
                    width={20}
                  />
                  {!hiddenOptions.cryptoDogecoin && (
                    <Image
                      alt="Dogecoin"
                      className="size-5 shrink-0 object-contain"
                      height={20}
                      src="/payments/doge.svg"
                      width={20}
                    />
                  )}
                  {!hiddenOptions.cryptoMonero && (
                    <Image
                      alt="Monero"
                      className="size-5 shrink-0 object-contain"
                      height={20}
                      src="/crypto/monero/monero-xmr-logo.svg"
                      width={20}
                    />
                  )}
                </div>
              </label>
              {paymentMethod === "crypto" && (
                <div className="space-y-2 border-t border-border px-3 pb-3 pt-4">
                  {visibleCryptoSubOptions.map((opt) => (
                    <div key={opt.value}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20">
                        <input
                          type="radio"
                          name="payment-crypto"
                          checked={paymentSubOption === opt.value}
                          onChange={() => {
                            setPaymentSubOption(opt.value as CryptoSub);
                            setValidationErrors([]);
                            if (opt.value !== "other")
                              setCryptoOtherSubOption("");
                          }}
                          className="size-4 border-input text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{opt.label}</span>
                        {CRYPTO_LOGO_SRC[opt.value as keyof typeof CRYPTO_LOGO_SRC] && (
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
                        <div className="ml-5 mt-2 space-y-2 border-l-2 border-muted pl-4">
                          {ETH_CHAIN_OPTIONS.map((chainOpt) => (
                            <label
                              key={chainOpt.value}
                              className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20"
                            >
                              <input
                                type="radio"
                                name="payment-crypto-eth-chain"
                                checked={cryptoEthChain === chainOpt.value}
                                onChange={() => {
                                  setCryptoEthChain(chainOpt.value);
                                  setValidationErrors([]);
                                }}
                                className="size-4 border-input text-primary focus:ring-primary"
                              />
                              <span className="text-sm">
                                {chainOpt.label}
                              </span>
                              <Image
                                alt={chainOpt.label}
                                className="ml-auto h-7 w-9 shrink-0 object-contain"
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
                          <div className="ml-5 mt-2 space-y-2 border-l-2 border-muted pl-4">
                            {OTHER_SUB_OPTIONS.map((otherOpt) => (
                              <label
                                key={otherOpt.value}
                                className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20"
                              >
                                <input
                                  type="radio"
                                  name="payment-crypto-other"
                                  checked={
                                    cryptoOtherSubOption === otherOpt.value
                                  }
                                  onChange={() => {
                                    setCryptoOtherSubOption(otherOpt.value);
                                    setValidationErrors([]);
                                  }}
                                  className="size-4 border-input text-primary focus:ring-primary"
                                />
                                <span className="text-sm">
                                  {otherOpt.label}
                                </span>
                                {CRYPTO_LOGO_SRC[otherOpt.value] && (
                                  <Image
                                    alt={otherOpt.label}
                                    className="ml-auto h-7 w-9 shrink-0 object-contain"
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
                    type="radio"
                    name="payment"
                    checked={paymentMethod === "stablecoins"}
                    onChange={() => setPaymentTop("stablecoins")}
                    className="size-4 border-input text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium">Stablecoins (USDC / USDT)</span>
                </div>
              </label>
              {paymentMethod === "stablecoins" && (
                <div className="space-y-3 border-t border-border px-3 pb-3 pt-4">
                  <div className="flex gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="stablecoin-token"
                        checked={stablecoinToken === "usdc"}
                        onChange={() => {
                          setStablecoinToken("usdc");
                          setPaymentSubOption("solana" as UsdcSub);
                        }}
                        className="size-4 border-input text-primary focus:ring-primary"
                      />
                      <span className="text-sm">USDC</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="stablecoin-token"
                        checked={stablecoinToken === "usdt"}
                        onChange={() => {
                          setStablecoinToken("usdt");
                          setPaymentSubOption("ethereum" as UsdtSub);
                        }}
                        className="size-4 border-input text-primary focus:ring-primary"
                      />
                      <span className="text-sm">USDT</span>
                    </label>
                  </div>
                  {stablecoinToken === "usdc" &&
                    visibleUsdcSubOptions.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20"
                      >
                        <input
                          type="radio"
                          name="usdc-network"
                          checked={paymentSubOption === opt.value}
                          onChange={() =>
                            setPaymentSubOption(opt.value as UsdcSub)
                          }
                          className="size-4 border-input text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{opt.label}</span>
                        <Image
                          alt={opt.label}
                          className="ml-auto h-7 w-9 shrink-0 object-contain"
                          height={28}
                          src="/crypto/ethereum/ethereum-logo.svg"
                          width={36}
                        />
                      </label>
                    ))}
                  {stablecoinToken === "usdt" &&
                    visibleUsdtSubOptions.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20"
                      >
                        <input
                          type="radio"
                          name="usdt-network"
                          checked={paymentSubOption === opt.value}
                          onChange={() =>
                            setPaymentSubOption(opt.value as UsdtSub)
                          }
                          className="size-4 border-input text-primary focus:ring-primary"
                        />
                        <span className="text-sm">{opt.label}</span>
                        <Image
                          alt={opt.label}
                          className="ml-auto h-7 w-9 shrink-0 object-contain"
                          height={28}
                          src="/crypto/ethereum/ethereum-logo.svg"
                          width={36}
                        />
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}
          {!hiddenOptions.paypal && (
            <label className={paymentOptionRowClass}>
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "paypal"}
                  onChange={() => setPaymentTop("paypal")}
                  className="size-4 border-input text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">PayPal</span>
              </div>
            </label>
          )}
          {paymentMethod === "paypal" && (
            <div className="border-t border-border px-3 pb-3 pt-4">
              <p className="text-sm text-muted-foreground">Coming soon.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {validationErrors.length > 0 && (
          <div
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
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
          <Button
            className={paymentButtonClass}
            size="lg"
            type="button"
            disabled={navigatingToPay}
            onClick={handlePlaceOrder}
          >
            {navigatingToPay ? "Redirecting…" : "Place order"}
          </Button>
        ) : isBtcPaySupported ? (
          <Button
            className={paymentButtonClass}
            size="lg"
            type="button"
            disabled={navigatingToPay}
            onClick={handleGoToBtcPay}
          >
            {navigatingToPay
              ? "Redirecting…"
              : paymentSubOption === "bitcoin"
                ? "Pay with Bitcoin"
                : paymentSubOption === "dogecoin"
                  ? "Pay with Dogecoin"
                  : "Pay with Monero"}
          </Button>
        ) : isEvmPaySupported ? (
          <Button
            className={paymentButtonClass}
            size="lg"
            type="button"
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToEthPay}
          >
            {navigatingToPay
              ? "Redirecting…"
              : paymentMethod === "crypto"
                ? `Pay with ETH (${cryptoEthChain === "ethereum" ? "Ethereum" : cryptoEthChain === "arbitrum" ? "Arbitrum" : cryptoEthChain === "base" ? "Base" : "Polygon"})`
                : paymentMethod === "stablecoins" &&
                    stablecoinToken === "usdc"
                  ? `Pay with USDC (${paymentSubOption === "ethereum" ? "Ethereum" : paymentSubOption === "arbitrum" ? "Arbitrum" : paymentSubOption === "base" ? "Base" : "Polygon"})`
                  : `Pay with USDT (${paymentSubOption === "ethereum" ? "Ethereum" : paymentSubOption === "arbitrum" ? "Arbitrum" : paymentSubOption === "base" ? "Base" : paymentSubOption === "bnb" ? "BNB" : "Polygon"})`}
          </Button>
        ) : isSolanaPaySupported ? (
          <Button
            className={paymentButtonClass}
            size="lg"
            type="button"
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToCryptoPay}
          >
            {navigatingToPay
              ? "Redirecting…"
              : paymentMethod === "crypto" && paymentSubOption === "crust"
                ? "Pay with CRUST"
                : paymentMethod === "crypto" && paymentSubOption === "pump"
                  ? "Pay with Pump"
                  : paymentMethod === "stablecoins" &&
                      stablecoinToken === "usdc" &&
                      paymentSubOption === "solana"
                    ? "Pay with USDC (Solana)"
                    : "Pay with Solana"}
          </Button>
        ) : isSuiPaySupported ? (
          <Button
            className={paymentButtonClass}
            size="lg"
            type="button"
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToCryptoPay}
          >
            {navigatingToPay ? "Redirecting…" : "Pay with SUI"}
          </Button>
        ) : isTonPaySupported ? (
          <Button
            className={paymentButtonClass}
            size="lg"
            type="button"
            disabled={navigatingToPay || !canShipToCountry}
            onClick={handleGoToTonPay}
          >
            {navigatingToPay ? "Redirecting…" : "Pay with TON"}
          </Button>
        ) : paymentMethod === "" ? (
          <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Select a payment method above.
          </p>
        ) : paymentMethod === "crypto" && paymentSubOption === "" ? (
          <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Select a crypto option above (e.g. Ethereum, Solana,
            Crustafarian).
          </p>
        ) : paymentMethod === "stablecoins" ? (
          <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Select USDC or USDT and a network above.
          </p>
        ) : (
          <p className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            This payment option is not available yet. Use Credit/debit card,
            Crypto, Stablecoins (USDC/USDT), or PayPal.
          </p>
        )}
        <div className="border-t border-border pt-4">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-muted-foreground">
            <PolicyPopup
              title="Refund policy"
              content={REFUND_POLICY_SUMMARY}
              fullPolicyHref="/policies/refund"
            >
              Refund policy
            </PolicyPopup>
            <span aria-hidden>·</span>
            <PolicyPopup
              title="Shipping policy"
              content={SHIPPING_POLICY_CONTENT}
              fullPolicyHref="/policies/shipping"
            >
              Shipping policy
            </PolicyPopup>
            <span aria-hidden>·</span>
            <PolicyPopup
              title="Privacy policy"
              content={PRIVACY_POLICY_SUMMARY}
              fullPolicyHref="/policies/privacy"
            >
              Privacy policy
            </PolicyPopup>
            <span aria-hidden>·</span>
            <PolicyPopup
              title="Terms of service"
              content={TERMS_POLICY_SUMMARY}
              fullPolicyHref="/policies/terms"
            >
              Terms of service
            </PolicyPopup>
          </p>
        </div>
      </div>

      <SolanaPayDialog
        open={solanaPayOpen}
        onOpenChange={(open) => !open && closeSolanaPayDialog()}
        paymentUrl={solanaPayPaymentUrl}
        status={solanaPayStatus}
        amountUsd={solanaPayAmountUsd}
        tokenSymbol="USDC"
        recipientAddress={solanaPayRecipientAddress ?? undefined}
        orderId={solanaPayOrderId ?? undefined}
      />
    </>
  );
}
