"use client";

import {
  ArrowLeft,
  CreditCard,
  Globe,
  Loader2,
  Signal,
  Smartphone,
  Wallet,
  Wifi,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  CRYPTO_LOGO_SRC,
  ETH_CHAIN_OPTIONS,
  OTHER_SUB_OPTIONS,
  VISIBLE_CRYPTO_SUB_OPTIONS,
} from "~/app/checkout/checkout-payment-constants";
import { useCurrentUser } from "~/lib/auth-client";
import {
  hasAnyCryptoEnabled,
  hasAnyStablecoinEnabled,
  visibleCryptoSubFromVisibility,
  visibleUsdcNetworks,
  visibleUsdtNetworks,
} from "~/lib/checkout-payment-options";
import { formatEsimPackageName } from "~/lib/esim-format";
import { useCart } from "~/lib/hooks/use-cart";
import { useCountryCurrency } from "~/lib/hooks/use-country-currency";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import { Separator } from "~/ui/primitives/separator";

interface CoverageCountry {
  id: number;
  image_url: string;
  name: string;
  network_coverage: NetworkCoverage[];
}

/** Crypto sub-option key (matches checkout page). */
type CryptoSub =
  | "bitcoin"
  | "crust"
  | "cult"
  | "dogecoin"
  | "eth"
  | "monero"
  | "other"
  | "pump"
  | "seeker"
  | "solana"
  | "soluna"
  | "troll";

// ---------- Types ----------

interface NetworkCoverage {
  five_G: boolean;
  four_G: boolean;
  network_code: string;
  network_name: string;
  three_g: boolean;
  two_g: boolean;
}

interface PackageDetail {
  countries?: CoverageCountry[];
  data_quantity: number;
  data_unit: string;
  id: string;
  name: string;
  package_type?: string;
  package_validity: number;
  package_validity_unit: string;
  price: string;
  romaing_countries?: CoverageCountry[];
  sms_quantity?: number;
  unlimited?: boolean;
  voice_quantity?: number;
  voice_unit?: string;
}

/** Top-level payment method (matches checkout page structure). */
type PaymentMethodTop = "card" | "crypto" | "paypal" | "stablecoins";

// ---------- Component ----------

export function EsimPackageDetailClient({ packageId }: { packageId: string }) {
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const { addItem, openCart } = useCart();
  const { convertUsdToFiat, currency, formatFiat } = useCountryCurrency();
  const { visibility: paymentVisibility } = usePaymentMethodSettings();
  const backToStoreQuery = searchParams.toString();
  const backToStoreHref = backToStoreQuery
    ? `/esim?${backToStoreQuery}`
    : "/esim";

  const [pkg, setPkg] = useState<null | PackageDetail>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  /** When user selects a payment method with an automatic eSIM discount (e.g. Seeker) or tier discount. */
  const [discountPreview, setDiscountPreview] = useState<null | {
    discountCents: number;
    totalAfterDiscountCents: number;
  }>(null);
  /** Linked Solana wallet for tier-based discount (from /api/user/membership). */
  const [memberWallet, setMemberWallet] = useState<null | string>(null);
  /** Member tier (1–3) when no wallet linked, from tier history (from /api/user/membership). */
  const [memberTier, setMemberTier] = useState<null | number>(null);

  // Visibility flags from admin settings
  const showCard = paymentVisibility?.creditCard !== false;
  const showPaypal = paymentVisibility?.paypal !== false;
  const showCrypto =
    paymentVisibility === null ? true : hasAnyCryptoEnabled(paymentVisibility);
  const showStablecoins =
    paymentVisibility === null
      ? true
      : hasAnyStablecoinEnabled(paymentVisibility);
  const showUsdc = paymentVisibility?.stablecoinUsdc !== false;
  const showUsdt = paymentVisibility?.stablecoinUsdt !== false;

  // Visible crypto sub-options (matches checkout page)
  const visibleCryptoSubs = useMemo(
    () =>
      paymentVisibility
        ? visibleCryptoSubFromVisibility(paymentVisibility)
        : VISIBLE_CRYPTO_SUB_OPTIONS,
    [paymentVisibility],
  );

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodTop>("card");
  const [cryptoSub, setCryptoSub] = useState<CryptoSub>("solana");
  const [cryptoOtherSub, setCryptoOtherSub] = useState<"sui" | "ton">("ton");
  const [ethChain, setEthChain] = useState<string>("ethereum");
  const [stablecoinToken, setStablecoinToken] = useState<"usdc" | "usdt">(
    "usdc",
  );
  const [stablecoinChain, setStablecoinChain] = useState<string>("solana");

  // Chain options for the selected stablecoin token — filtered by admin settings
  const stablecoinChainOptions = useMemo(
    () =>
      stablecoinToken === "usdt"
        ? visibleUsdtNetworks(paymentVisibility)
        : visibleUsdcNetworks(paymentVisibility),
    [stablecoinToken, paymentVisibility],
  );

  // When the token changes, reset chain to the first admin-enabled option for that token
  const handleStablecoinTokenChange = useCallback(
    (token: "usdc" | "usdt") => {
      setStablecoinToken(token);
      const opts =
        token === "usdt"
          ? visibleUsdtNetworks(paymentVisibility)
          : visibleUsdcNetworks(paymentVisibility);
      setStablecoinChain(opts[0]?.value ?? "ethereum");
    },
    [paymentVisibility],
  );

  // Apply admin defaults once visibility loads
  const hasAppliedVisibilityRef = useRef(false);
  useEffect(() => {
    if (paymentVisibility !== null && !hasAppliedVisibilityRef.current) {
      hasAppliedVisibilityRef.current = true;
      // Default top-level payment method
      setPaymentMethod(
        showCard
          ? "card"
          : showCrypto
            ? "crypto"
            : showStablecoins
              ? "stablecoins"
              : "paypal",
      );
      // Default crypto sub
      const firstCrypto = visibleCryptoSubs[0]?.value as CryptoSub | undefined;
      if (firstCrypto) setCryptoSub(firstCrypto);
      // Default stablecoin token + chain
      const defaultToken = paymentVisibility.stablecoinUsdc ? "usdc" : "usdt";
      setStablecoinToken(defaultToken);
      const chainOpts =
        defaultToken === "usdt"
          ? visibleUsdtNetworks(paymentVisibility)
          : visibleUsdcNetworks(paymentVisibility);
      setStablecoinChain(chainOpts[0]?.value ?? "solana");
    }
  }, [
    paymentVisibility,
    showCard,
    showCrypto,
    showStablecoins,
    visibleCryptoSubs,
  ]);

  const fetchPackageDetail = useCallback(async () => {
    setLoading(true);
    setPkg(null);
    const maxAttempts = 3;
    const delayMs = (attempt: number) =>
      attempt === 0 ? 0 : 500 * 1.5 ** (attempt - 1);

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, delayMs(attempt)));
        }
        try {
          const res = await fetch(`/api/esim/packages/${packageId}`);
          const data = (await res.json()) as {
            data?: PackageDetail;
            status: boolean;
          };
          if (data.status && data.data) {
            setPkg(data.data);
            return;
          }
        } catch (e) {
          console.error("eSIM package detail fetch error:", e);
        }
      }
      setPkg(null);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      const maxAttempts = 3;
      const delayMs = (attempt: number) =>
        attempt === 0 ? 0 : 500 * 1.5 ** (attempt - 1);

      for (let attempt = 0; attempt < maxAttempts && !cancelled; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, delayMs(attempt)));
        }
        try {
          const res = await fetch(`/api/esim/packages/${packageId}`);
          const data = (await res.json()) as {
            data?: PackageDetail;
            status: boolean;
          };
          if (data.status && data.data) {
            if (!cancelled) setPkg(data.data);
            return;
          }
        } catch (e) {
          if (!cancelled) console.error("eSIM package detail fetch error:", e);
        }
      }
      if (!cancelled) setPkg(null);
    };
    run().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  /**
   * Derive the paymentMethod string for the order (matches backend keys).
   * Also compute the crypto-checkout payload and redirect hash.
   */
  const resolvedPayment = useMemo(() => {
    if (paymentMethod === "card")
      return { hash: "", method: "stripe" } as const;
    if (paymentMethod === "paypal")
      return { hash: "", method: "paypal" } as const;

    if (paymentMethod === "stablecoins") {
      if (stablecoinChain === "solana") {
        // USDC/USDT on Solana → solana_pay
        return {
          chain: "solana",
          hash: "#solana",
          method: "solana_pay" as const,
          token: stablecoinToken,
        };
      }
      // EVM stablecoins
      return {
        chain: stablecoinChain,
        hash: "#eth",
        method: "eth_pay" as const,
        token: stablecoinToken.toUpperCase(),
      };
    }

    // Crypto sub-options
    if (cryptoSub === "bitcoin")
      return { hash: "#bitcoin", method: "btcpay" as const };
    if (cryptoSub === "dogecoin")
      return { hash: "#dogecoin", method: "btcpay" as const };
    if (cryptoSub === "monero")
      return { hash: "#monero", method: "btcpay" as const };
    if (cryptoSub === "eth")
      return {
        chain: ethChain,
        hash: "#eth",
        method: "eth_pay" as const,
        token: "ETH",
      };
    if (cryptoSub === "solana")
      return {
        hash: "#solana",
        method: "solana_pay" as const,
        token: "solana",
      };
    if (cryptoSub === "crust")
      return { hash: "#solana", method: "solana_pay" as const, token: "crust" };
    if (cryptoSub === "pump")
      return { hash: "#solana", method: "solana_pay" as const, token: "pump" };
    if (cryptoSub === "troll")
      return { hash: "#solana", method: "solana_pay" as const, token: "troll" };
    if (cryptoSub === "soluna")
      return {
        hash: "#solana",
        method: "solana_pay" as const,
        token: "soluna",
      };
    if (cryptoSub === "seeker")
      return {
        hash: "#solana",
        method: "solana_pay" as const,
        token: "seeker",
      };
    if (cryptoSub === "cult")
      return { hash: "#solana", method: "solana_pay" as const, token: "cult" };
    if (cryptoSub === "other" && cryptoOtherSub === "ton")
      return { hash: "#ton", method: "ton_pay" as const };
    if (cryptoSub === "other" && cryptoOtherSub === "sui")
      return { hash: "#sui", method: "sui" as const };
    return { hash: "#solana", method: "solana_pay" as const, token: "solana" };
  }, [
    paymentMethod,
    cryptoSub,
    cryptoOtherSub,
    ethChain,
    stablecoinToken,
    stablecoinChain,
  ]);

  const paymentMethodKey = useMemo(() => {
    const map: Record<string, string> = {
      crust: "crypto_crust",
      cult: "crypto_cult",
      pump: "crypto_pump",
      seeker: "crypto_seeker",
      solana: "crypto_solana",
      soluna: "crypto_soluna",
      troll: "crypto_troll",
      usdc: "stablecoin_usdc",
      usdt: "stablecoin_usdt",
    };
    if ("token" in resolvedPayment && resolvedPayment.token)
      return map[resolvedPayment.token.toLowerCase()] ?? null;
    return null;
  }, [resolvedPayment]);

  // Fetch membership (wallet + tier) for tier-based discount when user is logged in
  useEffect(() => {
    if (!user?.id) {
      setMemberWallet(null);
      setMemberTier(null);
      return;
    }
    let cancelled = false;
    fetch("/api/user/membership", { credentials: "include" })
      .then((r) => r.json())
      .then((raw: unknown) => {
        const data = raw as null | { memberTier?: number; wallet?: string };
        if (cancelled) return;
        setMemberWallet(data?.wallet ?? null);
        setMemberTier(
          typeof data?.memberTier === "number" &&
            data.memberTier >= 1 &&
            data.memberTier <= 3
            ? data.memberTier
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setMemberWallet(null);
          setMemberTier(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Fetch automatic discount preview when package and payment method are set (includes tier discount when wallet is present).
  useEffect(() => {
    if (!pkg || !paymentMethodKey) {
      setDiscountPreview(null);
      return;
    }
    const ac = new AbortController();
    const subtotalCents = Math.round(Number(pkg.price) * 100);
    const productId = `esim_${packageId}`;
    fetch("/api/checkout/coupons/automatic", {
      body: JSON.stringify({
        items: [{ priceCents: subtotalCents, productId, quantity: 1 }],
        memberTier: memberWallet ? undefined : (memberTier ?? undefined),
        paymentMethodKey,
        productCount: 1,
        productIds: [productId],
        shippingFeeCents: 0,
        subtotalCents,
        wallet: memberWallet ?? undefined,
      }),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: ac.signal,
    })
      .then((res) => res.json())
      .then((raw: unknown) => {
        const data = raw as {
          applied?: boolean;
          discountCents?: number;
          totalAfterDiscountCents?: number;
        };
        if (
          data.applied &&
          typeof data.discountCents === "number" &&
          data.discountCents > 0 &&
          typeof data.totalAfterDiscountCents === "number"
        ) {
          setDiscountPreview({
            discountCents: data.discountCents,
            totalAfterDiscountCents: data.totalAfterDiscountCents,
          });
        } else {
          setDiscountPreview(null);
        }
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError"))
          setDiscountPreview(null);
      });
    return () => ac.abort();
  }, [pkg, packageId, paymentMethodKey, memberWallet, memberTier]);

  const handlePurchase = useCallback(async () => {
    if (!pkg) return;
    const email = user?.email ?? guestEmail.trim();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setPurchasing(true);
    try {
      // Derive payment method key for discount resolution (e.g. crypto_cult for 20% eSIM discount)
      const PAYMENT_METHOD_KEY_MAP: Record<string, string> = {
        crust: "crypto_crust",
        cult: "crypto_cult",
        pump: "crypto_pump",
        seeker: "crypto_seeker",
        solana: "crypto_solana",
        soluna: "crypto_soluna",
        troll: "crypto_troll",
        usdc: "stablecoin_usdc",
        usdt: "stablecoin_usdt",
      };
      const paymentMethodKey =
        "token" in resolvedPayment && resolvedPayment.token
          ? PAYMENT_METHOD_KEY_MAP[resolvedPayment.token.toLowerCase()]
          : undefined;

      // 1. Create the order
      const orderRes = await fetch("/api/esim/purchase", {
        body: JSON.stringify({
          packageId,
          packageType: pkg.package_type ?? "DATA-ONLY",
          paymentMethod:
            resolvedPayment.method === "sui"
              ? "solana_pay"
              : resolvedPayment.method,
          ...(paymentMethodKey ? { paymentMethodKey } : {}),
          ...(user ? {} : { email: guestEmail.trim() }),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const orderData = (await orderRes.json()) as {
        data?: { orderId?: string };
        message?: string;
        status?: boolean;
      };
      if (!orderData.status) {
        toast.error(orderData.message ?? "Failed to create order.");
        return;
      }

      const orderId = orderData.data?.orderId as string;
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";

      // 2. Card / PayPal → Stripe checkout
      if (paymentMethod === "card" || paymentMethod === "paypal") {
        const checkoutRes = await fetch("/api/esim/checkout", {
          body: JSON.stringify({
            orderId,
            paymentMethod: paymentMethod === "paypal" ? "paypal" : "card",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const checkoutData = (await checkoutRes.json()) as {
          data?: { checkoutUrl?: string };
          message?: string;
          status?: boolean;
        };
        if (!checkoutData.status || !checkoutData.data?.checkoutUrl) {
          toast.error(
            checkoutData.message ?? "Failed to create checkout session.",
          );
          return;
        }
        window.location.href = checkoutData.data.checkoutUrl;
        return;
      }

      // 3. Sui → special hash-based checkout (no crypto-checkout API call needed)
      if (resolvedPayment.method === "sui") {
        const amount = parseFloat(pkg.price);
        const expires = Date.now() + 60 * 60 * 1000;
        window.location.href = `${baseUrl}/checkout/${orderId}#sui-${amount.toFixed(2)}-${expires}`;
        return;
      }

      // 4. Crypto / Stablecoins → set up via crypto-checkout API
      const cryptoPayload: Record<string, string> = {
        orderId,
        paymentMethod: resolvedPayment.method,
      };
      if ("chain" in resolvedPayment && resolvedPayment.chain) {
        cryptoPayload.chain = resolvedPayment.chain;
      }
      if ("token" in resolvedPayment && resolvedPayment.token) {
        cryptoPayload.token = resolvedPayment.token;
      }

      const cryptoRes = await fetch("/api/esim/crypto-checkout", {
        body: JSON.stringify(cryptoPayload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const cryptoData = (await cryptoRes.json()) as {
        message?: string;
        status?: boolean;
      };
      if (!cryptoData.status) {
        toast.error(cryptoData.message ?? "Failed to set up crypto payment.");
        return;
      }

      window.location.href = `${baseUrl}/checkout/${orderId}${resolvedPayment.hash}`;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }, [user, pkg, packageId, guestEmail, paymentMethod, resolvedPayment]);

  const handleAddToCart = useCallback(() => {
    if (!pkg) return;
    addItem({
      category: "eSIM",
      digital: true,
      esimPackageId: pkg.id,
      esimPackageType: pkg.package_type ?? "DATA-ONLY",
      id: `esim_${pkg.id}`,
      image: "/placeholder.svg",
      name: `eSIM: ${formatEsimPackageName(pkg.name)}`,
      price: parseFloat(pkg.price),
    });
    toast.success("eSIM added to cart");
    openCart();
  }, [pkg, addItem, openCart]);

  const coverageCountries = pkg?.countries ?? pkg?.romaing_countries ?? [];
  const has5g =
    coverageCountries.some((c) => c.network_coverage?.some((n) => n.five_G)) ??
    false;
  const displayName = pkg ? formatEsimPackageName(pkg.name) : "";

  if (loading) {
    return (
      <div
        className={`
          container mx-auto max-w-7xl px-4 py-16
          sm:px-6
          lg:px-8
        `}
      >
        <div className="flex items-center justify-center gap-2 py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading package details...
          </span>
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div
        className={`
          container mx-auto max-w-7xl px-4 py-16
          sm:px-6
          lg:px-8
        `}
      >
        <div className="py-24 text-center">
          <h2 className="text-xl font-semibold">Currently unavailable</h2>
          <p className="mt-2 text-muted-foreground">
            This eSIM plan may be temporarily unavailable. Try again or browse
            other plans.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              disabled={loading}
              onClick={() => void fetchPackageDetail()}
              variant="default"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                "Try again"
              )}
            </Button>
            <Button asChild disabled={loading} variant="outline">
              <Link href={backToStoreHref}>Browse other plans</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        container mx-auto max-w-7xl px-4 py-8
        sm:px-6
        lg:px-8
      `}
    >
      {/* Breadcrumb */}
      <Button asChild className="mb-6" size="sm" variant="ghost">
        <Link href={backToStoreHref}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to eSIM Store
        </Link>
      </Button>

      <div
        className={`
          grid gap-8
          lg:grid-cols-2
        `}
      >
        {/* Package Info - Left */}
        <div className="min-w-0 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {pkg.package_type && (
                <Badge variant="secondary">{pkg.package_type}</Badge>
              )}
              {pkg.unlimited && <Badge>Unlimited</Badge>}
              {has5g && (
                <span
                  className={`
                    inline-flex items-center gap-1 rounded-md bg-primary/10 px-2
                    py-0.5 text-xs font-medium text-primary
                  `}
                  title="5G available"
                >
                  <Signal className="h-3.5 w-3.5" />
                  5G
                </span>
              )}
            </div>
          </div>

          {/* Data specs */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Plan Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-semibold">
                      {pkg.unlimited || pkg.data_quantity === 0
                        ? "∞"
                        : `${pkg.data_quantity} ${pkg.data_unit}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Signal className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Validity</p>
                    <p className="font-semibold">
                      {pkg.package_validity} {pkg.package_validity_unit}s
                    </p>
                  </div>
                </div>
                {(pkg.voice_quantity ?? 0) > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">Voice</p>
                        <p className="font-semibold">
                          {pkg.voice_quantity} {pkg.voice_unit}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm text-muted-foreground">SMS</p>
                        <p className="font-semibold">{pkg.sms_quantity} SMS</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coverage */}
          {coverageCountries.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Globe className="h-5 w-5" />
                  Coverage ({coverageCountries.length}{" "}
                  {coverageCountries.length === 1 ? "country" : "countries"})
                </h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coverageCountries.map((country) => (
                    <div key={country.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <Image
                          alt={country.name}
                          className="rounded-sm"
                          height={16}
                          src={country.image_url}
                          unoptimized
                          width={24}
                        />
                        <span className="text-sm font-medium">
                          {country.name}
                        </span>
                      </div>
                      {country.network_coverage.length > 0 && (
                        <div className="ml-8 space-y-1">
                          {country.network_coverage.map((net) => (
                            <div
                              className={`
                                flex items-center gap-2 text-xs
                                text-muted-foreground
                              `}
                              key={net.network_code}
                            >
                              <span>{net.network_name}</span>
                              <div className="flex gap-1">
                                {net.two_g && (
                                  <Badge
                                    className="px-1 text-[10px]"
                                    variant="outline"
                                  >
                                    2G
                                  </Badge>
                                )}
                                {net.three_g && (
                                  <Badge
                                    className="px-1 text-[10px]"
                                    variant="outline"
                                  >
                                    3G
                                  </Badge>
                                )}
                                {net.four_G && (
                                  <Badge
                                    className="px-1 text-[10px]"
                                    variant="outline"
                                  >
                                    4G
                                  </Badge>
                                )}
                                {net.five_G && (
                                  <Badge
                                    className="px-1 text-[10px]"
                                    variant="outline"
                                  >
                                    5G
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <Separator className="mt-3" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Purchase Card - Right */}
        <div className="min-w-0">
          <div className="sticky top-24">
            <Card className="border-primary/20">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <div className="flex flex-wrap items-baseline gap-2">
                    {discountPreview ? (
                      <>
                        <span
                          className={`
                            text-lg text-muted-foreground line-through
                          `}
                        >
                          ${pkg.price}
                        </span>
                        <p className="text-3xl font-bold text-primary">
                          $
                          {(
                            discountPreview.totalAfterDiscountCents / 100
                          ).toFixed(2)}
                        </p>
                        <span
                          className={`
                            rounded bg-primary/10 px-1.5 py-0.5 text-xs
                            font-medium text-primary
                          `}
                        >
                          {Math.round(
                            (discountPreview.discountCents /
                              (Number(pkg.price) * 100)) *
                              100,
                          )}
                          % off with selected payment
                        </span>
                      </>
                    ) : (
                      <p className="text-3xl font-bold text-primary">
                        ${pkg.price}
                      </p>
                    )}
                  </div>
                  {currency !== "USD" &&
                    (() => {
                      const amount = discountPreview
                        ? discountPreview.totalAfterDiscountCents / 100
                        : Number(pkg.price);
                      const localAmount = convertUsdToFiat(amount);
                      return localAmount != null ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          ≈ {formatFiat(localAmount)}
                        </p>
                      ) : null;
                    })()}
                  <p className="mt-1 text-xs text-muted-foreground">
                    $
                    {(
                      (discountPreview
                        ? discountPreview.totalAfterDiscountCents / 100
                        : Number(pkg.price)) / pkg.package_validity
                    ).toFixed(2)}
                    /day
                  </p>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">
                      {pkg.unlimited || pkg.data_quantity === 0
                        ? "∞"
                        : `${pkg.data_quantity} ${pkg.data_unit}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Validity</span>
                    <span className="font-medium">
                      {pkg.package_validity} {pkg.package_validity_unit}s
                    </span>
                  </div>
                  {(pkg.voice_quantity ?? 0) > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Voice</span>
                        <span className="font-medium">
                          {pkg.voice_quantity} {pkg.voice_unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SMS</span>
                        <span className="font-medium">
                          {pkg.sms_quantity} SMS
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coverage</span>
                    <span className="font-medium">
                      {coverageCountries.length}{" "}
                      {coverageCountries.length === 1 ? "country" : "countries"}
                    </span>
                  </div>
                </div>

                {!user && (
                  <div className="space-y-2">
                    <Label htmlFor="esim-guest-email">Email</Label>
                    <Input
                      autoComplete="email"
                      className="w-full"
                      id="esim-guest-email"
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="your@email.com"
                      type="email"
                      value={guestEmail}
                    />
                  </div>
                )}

                {/* ── Payment method picker (matches checkout page) ── */}
                <div className="space-y-2">
                  <Label>Payment method</Label>
                  <div className="flex flex-wrap gap-2">
                    {showCard && (
                      <Button
                        onClick={() => setPaymentMethod("card")}
                        size="sm"
                        type="button"
                        variant={
                          paymentMethod === "card" ? "default" : "outline"
                        }
                      >
                        <CreditCard className="mr-1 h-3.5 w-3.5" />
                        Card
                      </Button>
                    )}
                    {showCrypto && (
                      <Button
                        onClick={() => setPaymentMethod("crypto")}
                        size="sm"
                        type="button"
                        variant={
                          paymentMethod === "crypto" ? "default" : "outline"
                        }
                      >
                        <Wallet className="mr-1 h-3.5 w-3.5" />
                        Crypto
                      </Button>
                    )}
                    {showStablecoins && (
                      <Button
                        onClick={() => setPaymentMethod("stablecoins")}
                        size="sm"
                        type="button"
                        variant={
                          paymentMethod === "stablecoins"
                            ? "default"
                            : "outline"
                        }
                      >
                        Stablecoins
                      </Button>
                    )}
                    {showPaypal && (
                      <Button
                        onClick={() => setPaymentMethod("paypal")}
                        size="sm"
                        type="button"
                        variant={
                          paymentMethod === "paypal" ? "default" : "outline"
                        }
                      >
                        PayPal
                      </Button>
                    )}
                  </div>

                  {/* Crypto sub-options */}
                  {paymentMethod === "crypto" &&
                    visibleCryptoSubs.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex flex-wrap gap-2">
                          {visibleCryptoSubs.map((opt) => {
                            const logo =
                              CRYPTO_LOGO_SRC[
                                opt.value as keyof typeof CRYPTO_LOGO_SRC
                              ];
                            return (
                              <Button
                                className="gap-1.5"
                                key={opt.value}
                                onClick={() =>
                                  setCryptoSub(opt.value as CryptoSub)
                                }
                                size="sm"
                                type="button"
                                variant={
                                  cryptoSub === opt.value
                                    ? "default"
                                    : "outline"
                                }
                              >
                                {logo && (
                                  <img alt="" className="h-4 w-4" src={logo} />
                                )}
                                {opt.label}
                              </Button>
                            );
                          })}
                        </div>

                        {/* Ethereum chain picker */}
                        {cryptoSub === "eth" && (
                          <div
                            className={`
                              space-y-1 rounded-lg border border-border
                              bg-muted/30 p-3
                            `}
                          >
                            <p
                              className={`
                                text-xs font-medium text-muted-foreground
                              `}
                            >
                              Network
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {ETH_CHAIN_OPTIONS.map((opt) => (
                                <Button
                                  key={opt.value}
                                  onClick={() => setEthChain(opt.value)}
                                  size="sm"
                                  type="button"
                                  variant={
                                    ethChain === opt.value
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {opt.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Other sub-options (Sui, TON) */}
                        {cryptoSub === "other" && (
                          <div
                            className={`
                              space-y-1 rounded-lg border border-border
                              bg-muted/30 p-3
                            `}
                          >
                            <div className="flex flex-wrap gap-2">
                              {OTHER_SUB_OPTIONS.map((opt) => {
                                const logo =
                                  CRYPTO_LOGO_SRC[
                                    opt.value as keyof typeof CRYPTO_LOGO_SRC
                                  ];
                                return (
                                  <Button
                                    className="gap-1.5"
                                    key={opt.value}
                                    onClick={() => setCryptoOtherSub(opt.value)}
                                    size="sm"
                                    type="button"
                                    variant={
                                      cryptoOtherSub === opt.value
                                        ? "default"
                                        : "outline"
                                    }
                                  >
                                    {logo && (
                                      <img
                                        alt=""
                                        className="h-4 w-4"
                                        src={logo}
                                      />
                                    )}
                                    {opt.label}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Stablecoins sub-options */}
                  {paymentMethod === "stablecoins" && (
                    <div
                      className={`
                        mt-2 space-y-2 rounded-lg border border-border
                        bg-muted/30 p-3
                      `}
                    >
                      {/* Token: USDC or USDT */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Token
                        </p>
                        <div className="flex gap-2">
                          {showUsdc && (
                            <Button
                              onClick={() =>
                                handleStablecoinTokenChange("usdc")
                              }
                              size="sm"
                              type="button"
                              variant={
                                stablecoinToken === "usdc"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              USDC
                            </Button>
                          )}
                          {showUsdt && (
                            <Button
                              onClick={() =>
                                handleStablecoinTokenChange("usdt")
                              }
                              size="sm"
                              type="button"
                              variant={
                                stablecoinToken === "usdt"
                                  ? "default"
                                  : "outline"
                              }
                            >
                              USDT
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Chain / network */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Network
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {stablecoinChainOptions.map((opt) => (
                            <Button
                              key={opt.value}
                              onClick={() => setStablecoinChain(opt.value)}
                              size="sm"
                              type="button"
                              variant={
                                stablecoinChain === opt.value
                                  ? "default"
                                  : "outline"
                              }
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  disabled={purchasing}
                  onClick={handlePurchase}
                  size="lg"
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing checkout...
                    </>
                  ) : discountPreview ? (
                    `Buy eSIM — $${(discountPreview.totalAfterDiscountCents / 100).toFixed(2)}`
                  ) : (
                    `Buy eSIM — $${pkg.price}`
                  )}
                </Button>

                <Button
                  className="w-full"
                  onClick={handleAddToCart}
                  size="lg"
                  variant="outline"
                >
                  Add to Cart
                </Button>

                <div
                  className={`
                    space-y-2 rounded-lg bg-muted/50 p-4 text-sm
                    text-muted-foreground
                  `}
                >
                  <p className="text-base font-semibold text-foreground">
                    Instant Digital Delivery
                  </p>
                  <p>
                    After payment, your eSIM will be provisioned and available
                    in your dashboard. Scan the QR code on your device to
                    activate.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Refund eligibility — full-width section below both columns */}
        <section
          className={`
            col-span-full mt-10 rounded-lg border border-muted bg-muted/30 p-6
          `}
        >
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            eSIM refund eligibility
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            eSIM plans have different refund rules. Please review before
            purchasing.
          </p>
          <ul
            className={`
              list-outside list-disc space-y-3 pl-5 text-sm break-words
              text-muted-foreground
            `}
          >
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">Unused eSIMs:</span>{" "}
              If not activated, you may submit a refund request within{" "}
              <strong>30 days</strong> of purchase. Requests after 30 days will
              not be approved.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">
                Instant refund:
              </span>{" "}
              Only when there is a verified technical or install failure, or a
              supported carrier&apos;s network signal failure, and the eSIM has
              not been activated and has no data consumption.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">
                Activated or used:
              </span>{" "}
              Any eSIM that has been activated, partially used, or has data
              consumption is <strong>non-refundable</strong>. Once an eSIM
              connects to a network, it is considered delivered and consumed.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">
                Carrier &amp; network:
              </span>{" "}
              No refund for country-wide shutdowns, temporary carrier outages,
              or local regulations affecting connectivity; service resumes when
              the network is available again.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">
                Vodafone &amp; O2:
              </span>{" "}
              Validity is only in officially supported countries. Using the eSIM
              outside those regions will disable the eSIM and no refund will be
              issued.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">
                Voice &amp; SMS plans:
              </span>{" "}
              All eSIM plans that include Voice and/or SMS are{" "}
              <strong>non-refundable</strong>, regardless of activation or
              usage.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
