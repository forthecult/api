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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useCurrentUser } from "~/lib/auth-client";
import { useCart } from "~/lib/hooks/use-cart";
import { Badge } from "~/ui/primitives/badge";
import { Button } from "~/ui/primitives/button";
import { Card, CardContent, CardHeader } from "~/ui/primitives/card";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";
import { Separator } from "~/ui/primitives/separator";

type PaymentCategory = "card" | "paypal" | "crypto";
type CryptoOption = "solana_pay" | "eth_pay" | "btcpay" | "ton_pay";
const CRYPTO_OPTIONS: { value: CryptoOption; label: string }[] = [
  { value: "solana_pay", label: "Solana" },
  { value: "eth_pay", label: "Ethereum" },
  { value: "btcpay", label: "Bitcoin" },
  { value: "ton_pay", label: "TON" },
];

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
  const { user } = useCurrentUser();
  const { addItem, openCart } = useCart();

  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>("card");
  const [cryptoOption, setCryptoOption] = useState<CryptoOption>("solana_pay");

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

  const paymentMethod =
    paymentCategory === "crypto"
      ? cryptoOption
      : paymentCategory === "paypal"
        ? "paypal"
        : "stripe";

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
      const orderRes = await fetch("/api/esim/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          packageType: pkg.package_type ?? "DATA-ONLY",
          paymentMethod,
          ...(user ? {} : { email: guestEmail.trim() }),
        }),
      });
      const orderData = await orderRes.json();
      if (!orderData.status) {
        toast.error(orderData.message ?? "Failed to create order.");
        return;
      }

      const orderId = orderData.data.orderId as string;

      if (paymentCategory === "card" || paymentCategory === "paypal") {
        const checkoutRes = await fetch("/api/esim/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            paymentMethod: paymentCategory === "paypal" ? "paypal" : "card",
          }),
        });
        const checkoutData = await checkoutRes.json();
        if (!checkoutData.status || !checkoutData.data?.checkoutUrl) {
          toast.error(
            checkoutData.message ?? "Failed to create checkout session.",
          );
          return;
        }
        window.location.href = checkoutData.data.checkoutUrl;
        return;
      }

      // Crypto: set up payment details and redirect to checkout page
      const cryptoRes = await fetch("/api/esim/crypto-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, paymentMethod: cryptoOption }),
      });
      const cryptoData = await cryptoRes.json();
      if (!cryptoData.status) {
        toast.error(cryptoData.message ?? "Failed to set up crypto payment.");
        return;
      }
      const hash =
        cryptoOption === "solana_pay"
          ? "solana"
          : cryptoOption === "eth_pay"
            ? "eth"
            : cryptoOption === "btcpay"
              ? "bitcoin"
              : "ton";
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      window.location.href = `${baseUrl}/checkout/${orderId}#${hash}`;
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }, [
    user,
    pkg,
    packageId,
    guestEmail,
    paymentCategory,
    cryptoOption,
  ]);

  const handleAddToCart = useCallback(() => {
    if (!pkg) return;
    addItem({
      id: `esim_${pkg.id}`,
      name: `eSIM: ${pkg.name}`,
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
          <h2 className="text-xl font-semibold">Package not found</h2>
          <p className="mt-2 text-muted-foreground">
            This eSIM package may no longer be available.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link href="/esim">Browse all packages</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link href="/esim">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to eSIM Store
        </Link>
      </Button>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Package Info - Left */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pkg.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {pkg.package_type && (
                <Badge variant="secondary">{pkg.package_type}</Badge>
              )}
              {pkg.unlimited && <Badge>Unlimited</Badge>}
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
                      {pkg.unlimited
                        ? "Unlimited"
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
                      {pkg.unlimited
                        ? "Unlimited"
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

                <div className="space-y-2">
                  <Label>Payment method</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={paymentCategory === "card" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentCategory("card")}
                    >
                      <CreditCard className="mr-1 h-3.5 w-3.5" />
                      Card
                    </Button>
                    <Button
                      type="button"
                      variant={paymentCategory === "paypal" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentCategory("paypal")}
                    >
                      PayPal
                    </Button>
                    <Button
                      type="button"
                      variant={paymentCategory === "crypto" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPaymentCategory("crypto")}
                    >
                      <Wallet className="mr-1 h-3.5 w-3.5" />
                      Crypto
                    </Button>
                  </div>
                  {paymentCategory === "crypto" && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {CRYPTO_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          variant={cryptoOption === opt.value ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setCryptoOption(opt.value)}
                        >
                          {opt.label}
                        </Button>
                      ))}
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

                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">
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
      </div>
    </div>
  );
}
