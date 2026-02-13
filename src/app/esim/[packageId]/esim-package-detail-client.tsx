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

import { useCurrentUser } from "~/lib/auth-client";
import { formatEsimPackageName } from "~/lib/esim-format";
import { useCart } from "~/lib/hooks/use-cart";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";
import {
  hasAnyCryptoEnabled,
  hasAnyStablecoinEnabled,
  visibleCryptoSubFromVisibility,
  visibleUsdcNetworks,
  visibleUsdtNetworks,
  type PaymentVisibility,
} from "~/lib/checkout-payment-options";
import {
  CRYPTO_LOGO_SRC,
  ETH_CHAIN_OPTIONS,
  OTHER_SUB_OPTIONS,
  VISIBLE_CRYPTO_SUB_OPTIONS,
} from "~/app/checkout/checkout-payment-constants";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import { Separator } from "~/ui/primitives/separator";

/** Top-level payment method (matches checkout page structure). */
type PaymentMethodTop = "card" | "crypto" | "stablecoins" | "paypal";

/** Crypto sub-option key (matches checkout page). */
type CryptoSub =
  | "bitcoin" | "dogecoin" | "eth" | "solana" | "monero"
  | "crust" | "pump" | "troll" | "other";

// ---------- Types ----------

type NetworkCoverage = {
  network_name: string;
  network_code: string;
  two_g: boolean;
  three_g: boolean;
  four_G: boolean;
  five_G: boolean;
};

type CoverageCountry = {
  id: number;
  name: string;
  image_url: string;
  network_coverage: NetworkCoverage[];
};

type PackageDetail = {
  id: string;
  name: string;
  price: string;
  data_quantity: number;
  data_unit: string;
  voice_quantity?: number;
  voice_unit?: string;
  sms_quantity?: number;
  package_validity: number;
  package_validity_unit: string;
  package_type?: string;
  unlimited?: boolean;
  countries?: CoverageCountry[];
  romaing_countries?: CoverageCountry[];
};

// ---------- Component ----------

export function EsimPackageDetailClient({
  packageId,
}: {
  packageId: string;
}) {
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const { addItem, openCart } = useCart();
  const { visibility: paymentVisibility } = usePaymentMethodSettings();
  const backToStoreQuery = searchParams.toString();
  const backToStoreHref = backToStoreQuery ? `/esim?${backToStoreQuery}` : "/esim";

  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");

  // Visibility flags from admin settings
  const showCard = paymentVisibility?.creditCard !== false;
  const showPaypal = paymentVisibility?.paypal !== false;
  const showCrypto =
    paymentVisibility === null
      ? true
      : hasAnyCryptoEnabled(paymentVisibility);
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
  const [stablecoinToken, setStablecoinToken] = useState<"usdc" | "usdt">("usdc");
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
      setPaymentMethod(showCard ? "card" : showCrypto ? "crypto" : showStablecoins ? "stablecoins" : "paypal");
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
  }, [paymentVisibility, showCard, showCrypto, showStablecoins, visibleCryptoSubs]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/esim/packages/${packageId}`)
      .then((res) => res.json())
      .then((data: { status: boolean; data?: PackageDetail }) => {
        if (data.status && data.data) {
          setPkg(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [packageId]);

  /**
   * Derive the paymentMethod string for the order (matches backend keys).
   * Also compute the crypto-checkout payload and redirect hash.
   */
  const resolvedPayment = useMemo(() => {
    if (paymentMethod === "card") return { method: "stripe", hash: "" } as const;
    if (paymentMethod === "paypal") return { method: "paypal", hash: "" } as const;

    if (paymentMethod === "stablecoins") {
      if (stablecoinChain === "solana") {
        // USDC/USDT on Solana → solana_pay
        return { method: "solana_pay" as const, hash: "#solana", token: stablecoinToken, chain: "solana" };
      }
      // EVM stablecoins
      return { method: "eth_pay" as const, hash: "#eth", token: stablecoinToken.toUpperCase(), chain: stablecoinChain };
    }

    // Crypto sub-options
    if (cryptoSub === "bitcoin") return { method: "btcpay" as const, hash: "#bitcoin" };
    if (cryptoSub === "dogecoin") return { method: "btcpay" as const, hash: "#dogecoin" };
    if (cryptoSub === "monero") return { method: "btcpay" as const, hash: "#monero" };
    if (cryptoSub === "eth") return { method: "eth_pay" as const, hash: "#eth", token: "ETH", chain: ethChain };
    if (cryptoSub === "solana") return { method: "solana_pay" as const, hash: "#solana", token: "solana" };
    if (cryptoSub === "crust") return { method: "solana_pay" as const, hash: "#solana", token: "crust" };
    if (cryptoSub === "pump") return { method: "solana_pay" as const, hash: "#solana", token: "pump" };
    if (cryptoSub === "troll") return { method: "solana_pay" as const, hash: "#solana", token: "troll" };
    if (cryptoSub === "other" && cryptoOtherSub === "ton") return { method: "ton_pay" as const, hash: "#ton" };
    if (cryptoSub === "other" && cryptoOtherSub === "sui") return { method: "sui" as const, hash: "#sui" };
    return { method: "solana_pay" as const, hash: "#solana", token: "solana" };
  }, [paymentMethod, cryptoSub, cryptoOtherSub, ethChain, stablecoinToken, stablecoinChain]);

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
      // 1. Create the order
      const orderRes = await fetch("/api/esim/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          packageType: pkg.package_type ?? "DATA-ONLY",
          paymentMethod: resolvedPayment.method === "sui" ? "solana_pay" : resolvedPayment.method,
          ...(user ? {} : { email: guestEmail.trim() }),
        }),
      });
      const orderData = await orderRes.json();
      if (!orderData.status) {
        toast.error(orderData.message ?? "Failed to create order.");
        return;
      }

      const orderId = orderData.data.orderId as string;
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      // 2. Card / PayPal → Stripe checkout
      if (paymentMethod === "card" || paymentMethod === "paypal") {
        const checkoutRes = await fetch("/api/esim/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            paymentMethod: paymentMethod === "paypal" ? "paypal" : "card",
          }),
        });
        const checkoutData = await checkoutRes.json();
        if (!checkoutData.status || !checkoutData.data?.checkoutUrl) {
          toast.error(checkoutData.message ?? "Failed to create checkout session.");
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cryptoPayload),
      });
      const cryptoData = await cryptoRes.json();
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
      id: `esim_${pkg.id}`,
      name: `eSIM: ${formatEsimPackageName(pkg.name)}`,
      price: parseFloat(pkg.price),
      category: "eSIM",
      image: "/placeholder.svg",
      digital: true,
      esimPackageId: pkg.id,
      esimPackageType: pkg.package_type ?? "DATA-ONLY",
    });
    toast.success("eSIM added to cart");
    openCart();
  }, [pkg, addItem, openCart]);

  const coverageCountries = pkg?.countries ?? pkg?.romaing_countries ?? [];
  const has5g =
    coverageCountries.some((c) =>
      c.network_coverage?.some((n) => n.five_G),
    ) ?? false;
  const displayName = pkg ? formatEsimPackageName(pkg.name) : "";

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
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
      <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center py-24">
          <h2 className="text-xl font-semibold">Currently unavailable</h2>
          <p className="mt-2 text-muted-foreground">
            This eSIM plan is sold out or no longer available. Check out other
            plans below.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link href={backToStoreHref}>Browse other plans</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link href={backToStoreHref}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to eSIM Store
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Package Info - Left */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              {pkg.package_type && (
                <Badge variant="secondary">{pkg.package_type}</Badge>
              )}
              {pkg.unlimited && <Badge>Unlimited</Badge>}
              {has5g && (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
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
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Coverage ({coverageCountries.length}{" "}
                  {coverageCountries.length === 1 ? "country" : "countries"})
                </h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {coverageCountries.map((country) => (
                    <div key={country.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <Image
                          src={country.image_url}
                          alt={country.name}
                          width={24}
                          height={16}
                          className="rounded-sm"
                          unoptimized
                        />
                        <span className="font-medium text-sm">
                          {country.name}
                        </span>
                      </div>
                      {country.network_coverage.length > 0 && (
                        <div className="ml-8 space-y-1">
                          {country.network_coverage.map((net) => (
                            <div
                              key={net.network_code}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <span>{net.network_name}</span>
                              <div className="flex gap-1">
                                {net.two_g && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1"
                                  >
                                    2G
                                  </Badge>
                                )}
                                {net.three_g && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1"
                                  >
                                    3G
                                  </Badge>
                                )}
                                {net.four_G && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1"
                                  >
                                    4G
                                  </Badge>
                                )}
                                {net.five_G && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1"
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
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <Card className="border-primary/20">
              <CardContent className="space-y-5 p-6">
                <div>
                  <p className="text-sm text-muted-foreground">Price</p>
                  <p className="text-3xl font-bold text-primary">
                    ${pkg.price}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    $
                    {(Number(pkg.price) / pkg.package_validity).toFixed(2)}/day
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
                      id="esim-guest-email"
                      type="email"
                      placeholder="your@email.com"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full"
                    />
                  </div>
                )}

                {/* ── Payment method picker (matches checkout page) ── */}
                <div className="space-y-2">
                  <Label>Payment method</Label>
                  <div className="flex flex-wrap gap-2">
                    {showCard && (
                      <Button
                        type="button"
                        variant={paymentMethod === "card" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod("card")}
                      >
                        <CreditCard className="mr-1 h-3.5 w-3.5" />
                        Card
                      </Button>
                    )}
                    {showCrypto && (
                      <Button
                        type="button"
                        variant={paymentMethod === "crypto" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod("crypto")}
                      >
                        <Wallet className="mr-1 h-3.5 w-3.5" />
                        Crypto
                      </Button>
                    )}
                    {showStablecoins && (
                      <Button
                        type="button"
                        variant={paymentMethod === "stablecoins" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod("stablecoins")}
                      >
                        Stablecoins
                      </Button>
                    )}
                    {showPaypal && (
                      <Button
                        type="button"
                        variant={paymentMethod === "paypal" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentMethod("paypal")}
                      >
                        PayPal
                      </Button>
                    )}
                  </div>

                  {/* Crypto sub-options */}
                  {paymentMethod === "crypto" && visibleCryptoSubs.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-wrap gap-2">
                        {visibleCryptoSubs.map((opt) => {
                          const logo = CRYPTO_LOGO_SRC[opt.value as keyof typeof CRYPTO_LOGO_SRC];
                          return (
                            <Button
                              key={opt.value}
                              type="button"
                              variant={cryptoSub === opt.value ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCryptoSub(opt.value as CryptoSub)}
                              className="gap-1.5"
                            >
                              {logo && (
                                <img src={logo} alt="" className="h-4 w-4" />
                              )}
                              {opt.label}
                            </Button>
                          );
                        })}
                      </div>

                      {/* Ethereum chain picker */}
                      {cryptoSub === "eth" && (
                        <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3">
                          <p className="text-xs font-medium text-muted-foreground">Network</p>
                          <div className="flex flex-wrap gap-2">
                            {ETH_CHAIN_OPTIONS.map((opt) => (
                              <Button
                                key={opt.value}
                                type="button"
                                variant={ethChain === opt.value ? "default" : "outline"}
                                size="sm"
                                onClick={() => setEthChain(opt.value)}
                              >
                                {opt.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Other sub-options (Sui, TON) */}
                      {cryptoSub === "other" && (
                        <div className="space-y-1 rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex flex-wrap gap-2">
                            {OTHER_SUB_OPTIONS.map((opt) => {
                              const logo = CRYPTO_LOGO_SRC[opt.value as keyof typeof CRYPTO_LOGO_SRC];
                              return (
                                <Button
                                  key={opt.value}
                                  type="button"
                                  variant={cryptoOtherSub === opt.value ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCryptoOtherSub(opt.value)}
                                  className="gap-1.5"
                                >
                                  {logo && (
                                    <img src={logo} alt="" className="h-4 w-4" />
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
                    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 mt-2">
                      {/* Token: USDC or USDT */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Token</p>
                        <div className="flex gap-2">
                          {showUsdc && (
                            <Button
                              type="button"
                              variant={stablecoinToken === "usdc" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleStablecoinTokenChange("usdc")}
                            >
                              USDC
                            </Button>
                          )}
                          {showUsdt && (
                            <Button
                              type="button"
                              variant={stablecoinToken === "usdt" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleStablecoinTokenChange("usdt")}
                            >
                              USDT
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* Chain / network */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Network</p>
                        <div className="flex flex-wrap gap-2">
                          {stablecoinChainOptions.map((opt) => (
                            <Button
                              key={opt.value}
                              type="button"
                              variant={stablecoinChain === opt.value ? "default" : "outline"}
                              size="sm"
                              onClick={() => setStablecoinChain(opt.value)}
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
                  size="lg"
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Preparing checkout...
                    </>
                  ) : (
                    `Buy eSIM — $${pkg.price}`
                  )}
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleAddToCart}
                >
                  Add to Cart
                </Button>

                <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-2">
                  <p className="font-semibold text-base text-foreground">
                    Instant Digital Delivery
                  </p>
                  <p>
                    After payment, your eSIM will be provisioned and available in
                    your dashboard. Scan the QR code on your device to activate.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Refund eligibility — full-width section below both columns */}
        <section className="col-span-full mt-10 rounded-lg border border-muted bg-muted/30 p-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            eSIM refund eligibility
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            eSIM plans have different refund rules. Please review before purchasing.
          </p>
          <ul className="text-sm text-muted-foreground space-y-3 list-disc list-outside pl-5 break-words">
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">Unused eSIMs:</span>{" "}
              If not activated, you may submit a refund request within <strong>30 days</strong> of purchase. Requests after 30 days will not be approved.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">Instant refund:</span>{" "}
              Only when there is a verified technical or install failure, or a supported carrier&apos;s network signal failure, and the eSIM has not been activated and has no data consumption.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">Activated or used:</span>{" "}
              Any eSIM that has been activated, partially used, or has data consumption is <strong>non-refundable</strong>. Once an eSIM connects to a network, it is considered delivered and consumed.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">Carrier &amp; network:</span>{" "}
              No refund for country-wide shutdowns, temporary carrier outages, or local regulations affecting connectivity; service resumes when the network is available again.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">Vodafone &amp; O2:</span>{" "}
              Validity is only in officially supported countries. Using the eSIM outside those regions will disable the eSIM and no refund will be issued.
            </li>
            <li className="leading-relaxed">
              <span className="font-medium text-foreground">Voice &amp; SMS plans:</span>{" "}
              All eSIM plans that include Voice and/or SMS are <strong>non-refundable</strong>, regardless of activation or usage.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
