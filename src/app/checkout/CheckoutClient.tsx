"use client";

import {
  createQR,
  encodeURL,
  FindReferenceError,
  findReference,
  validateTransfer,
} from "@solana/pay";
import { PublicKey } from "@solana/web3-compat";
// pay sdk findReference/validateTransfer need getSignaturesForAddress and getTransaction; compat Connection doesn't implement them yet
import { Connection as LegacyConnection } from "@solana/web3.js";
import Image from "next/image";
import { CircleHelp, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type BigNumber from "bignumber.js";

import { useCart } from "~/lib/hooks/use-cart";
import { usePaymentMethodSettings } from "~/lib/hooks/use-payment-method-settings";
import {
  getHiddenFromVisibility,
  hasAnyCryptoEnabled,
  hasAnyStablecoinEnabled,
  visibleCryptoSubFromVisibility,
} from "~/lib/checkout-payment-options";
import { useCurrentUser } from "~/lib/auth-client";
import { secureStorageSync } from "~/lib/secure-storage";
import { EXCLUDED_SHIPPING_COUNTRIES } from "~/lib/shipping-restrictions";
import {
  getSolanaPayLabel,
  getSolanaPayRecipient,
  USDC_MINT_MAINNET,
  usdcAmountFromUsd,
  tokenAmountFromUsd,
} from "~/lib/solana-pay";
import { SEO_CONFIG } from "~/app";
import { FiatPrice } from "~/ui/components/FiatPrice";
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
  DialogTrigger,
} from "~/ui/primitives/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/ui/primitives/popover";
import { Checkbox } from "~/ui/primitives/checkbox";
import { Input } from "~/ui/primitives/input";
import { cn } from "~/lib/cn";
import { getAffiliateCodeFromDocument } from "~/lib/affiliate-tracking";
import { type LoqateFindItem, mapRetrieveToShipping } from "~/lib/loqate";

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
  };
}

interface CheckoutFormState {
  apartment: string;
  city: string;
  company: string;
  country: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  state: string;
  street: string;
  zip: string;
}

interface BillingFormState {
  country: string;
  firstName: string;
  lastName: string;
  company: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
}

const defaultBillingForm: BillingFormState = {
  apartment: "",
  city: "",
  company: "",
  country: "",
  firstName: "",
  lastName: "",
  phone: "",
  state: "",
  street: "",
  zip: "",
};

const defaultForm: CheckoutFormState = {
  apartment: "",
  city: "",
  company: "",
  country: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  state: "",
  street: "",
  zip: "",
};

const CHECKOUT_SHIPPING_STORAGE_KEY = "checkout-shipping";

/**
 * Get persisted shipping form from encrypted storage
 * PII (email, address, phone) is encrypted at rest to protect customer data
 */
function getPersistedShippingForm(): CheckoutFormState {
  if (typeof window === "undefined") return defaultForm;
  try {
    // Use secure storage for PII protection
    const raw = secureStorageSync.getItem(CHECKOUT_SHIPPING_STORAGE_KEY);
    if (!raw) return defaultForm;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...defaultForm,
      ...(typeof parsed.email === "string" && { email: parsed.email }),
      ...(typeof parsed.firstName === "string" && {
        firstName: parsed.firstName,
      }),
      ...(typeof parsed.lastName === "string" && { lastName: parsed.lastName }),
      ...(typeof parsed.country === "string" && { country: parsed.country }),
      ...(typeof parsed.street === "string" && { street: parsed.street }),
      ...(typeof parsed.apartment === "string" && {
        apartment: parsed.apartment,
      }),
      ...(typeof parsed.city === "string" && { city: parsed.city }),
      ...(typeof parsed.state === "string" && { state: parsed.state }),
      ...(typeof parsed.zip === "string" && { zip: parsed.zip }),
      ...(typeof parsed.phone === "string" && { phone: parsed.phone }),
      ...(typeof parsed.company === "string" && { company: parsed.company }),
    };
  } catch {
    return defaultForm;
  }
}

/**
 * Persist shipping form to encrypted storage
 */
function persistShippingForm(form: CheckoutFormState): void {
  try {
    secureStorageSync.setItem(
      CHECKOUT_SHIPPING_STORAGE_KEY,
      JSON.stringify(form),
    );
  } catch {
    // Ignore quota or private mode errors
  }
}

/** Countries that use state/province as a distinct required field (e.g. US states, CA provinces, AU states). */
const COUNTRIES_REQUIRING_STATE = new Set(["US", "CA", "AU", "MX", "BR", "IN"]);
/** Countries that do not use postal/zip codes (rare; most countries do). */
const COUNTRIES_WITHOUT_POSTAL = new Set<string>(["HK"]);

const ALL_COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select country" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU", label: "Australia" },
  { value: "DE", label: "Germany" },
  { value: "FR", label: "France" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "NL", label: "Netherlands" },
  { value: "JP", label: "Japan" },
  { value: "NZ", label: "New Zealand" },
  { value: "HK", label: "Hong Kong" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "IL", label: "Israel" },
  { value: "KR", label: "South Korea" },
  { value: "SV", label: "El Salvador" },
  { value: "MX", label: "Mexico" },
  { value: "BR", label: "Brazil" },
  { value: "IN", label: "India" },
  { value: "OTHER", label: "Other" },
];
/** Exclude countries we do not ship to (all products). */
const COUNTRY_OPTIONS = ALL_COUNTRY_OPTIONS.filter(
  (opt) =>
    !opt.value ||
    opt.value === "OTHER" ||
    !EXCLUDED_SHIPPING_COUNTRIES.has(opt.value),
);

const US_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "State" },
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "AA", label: "Armed Forces Americas" },
  { value: "AE", label: "Armed Forces Europe" },
  { value: "AP", label: "Armed Forces Pacific" },
  { value: "AS", label: "American Samoa" },
  { value: "GU", label: "Guam" },
  { value: "MP", label: "Northern Mariana Islands" },
  { value: "PR", label: "Puerto Rico" },
  { value: "VI", label: "U.S. Virgin Islands" },
];

const SHIPPING_POLICY_CONTENT =
  "We partner with a number of fulfillment partners in an effort to ship all orders as quickly as possible. Most orders ship with 24 hours, and most domestic order deliver within 2-3 business days, and international orders deliver within 2 weeks. During high-demand and peak seasons, shipping can sometimes take up to 2 weeks. Unfortunately we cannot ship to a P.O Box.";

/** Shortened policy text for checkout footer popups. */
const REFUND_POLICY_SUMMARY =
  "We want you to be happy with your purchase. You have 30 days from delivery to request a return; items must be unworn/unused, with tags and original packaging. Contact us first for a return label. Refunds are processed within 10 business days after we receive and inspect your return. EU/UK: 14-day right to cancel for any reason.";
const PRIVACY_POLICY_SUMMARY =
  "Your privacy matters to us. We collect only what we need—contact and account details, order and shipping info, and basic usage data for security. We do not sell your data or use it for targeted advertising. We use only essential cookies (sign-in, cart, security). You have rights to access, correct, delete, or port your data.";
const TERMS_POLICY_SUMMARY =
  'By using Culture you agree to these terms and our Privacy, Refund, and Shipping policies. You must be the age of majority to use the service. We may refuse or cancel orders, limit quantities, and correct pricing errors. Products are provided "as is." We are not liable for indirect or consequential damages. We encourage contacting us first for disputes; governing law is the United States.';

// taller fields on checkout (h-11 ≈ 22% more than default h-9)
const checkoutFieldHeight = "h-11";
// uniform height for all payment option rows (match credit card row)
const paymentOptionRowClass =
  "min-h-12 flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted/30 dark:hover:bg-muted/40 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/20";

/** Fallback when payment method API has not loaded; hide card/paypal/crypto by default. */
const HIDDEN_PAYMENT_OPTIONS = {
  creditCard: true,
  paypal: true,
  cryptoBitcoin: true,
  cryptoDogecoin: true,
  cryptoMonero: true,
} as const;
// uniform height for all payment CTA buttons (Place order / Pay with X)
const paymentButtonClass = "h-[3.75rem] w-full";
const selectInputClass = cn(
  "flex w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground",
  checkoutFieldHeight,
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:pointer-events-none disabled:opacity-50",
);

/** top-level crypto options; "eth" shows nested chain choices, "other" shows nested options (e.g. Sui, TON), "crust" = Crustafarian */
const CRYPTO_SUB_OPTIONS: {
  value: "bitcoin" | "dogecoin" | "eth" | "solana" | "monero" | "crust" | "other";
  label: string;
}[] = [
  { value: "bitcoin", label: "Bitcoin (BTC)" },
  { value: "dogecoin", label: "Dogecoin (DOGE)" },
  { value: "eth", label: "Ethereum (ETH)" },
  { value: "solana", label: "Solana (SOL)" },
  { value: "monero", label: "Monero (XMR)" },
  { value: "crust", label: "Crustafarian (CRUST)" },
  { value: "other", label: "Other" },
];

/** Crypto sub-options visible in UI when using fallback (hidden options filtered out). */
const VISIBLE_CRYPTO_SUB_OPTIONS = CRYPTO_SUB_OPTIONS.filter((opt) => {
  if (opt.value === "bitcoin" && HIDDEN_PAYMENT_OPTIONS.cryptoBitcoin)
    return false;
  if (opt.value === "dogecoin" && HIDDEN_PAYMENT_OPTIONS.cryptoDogecoin)
    return false;
  if (opt.value === "monero" && HIDDEN_PAYMENT_OPTIONS.cryptoMonero)
    return false;
  return true;
});

const INITIAL_CRYPTO_SUB = (VISIBLE_CRYPTO_SUB_OPTIONS[0]?.value ?? "eth") as
  | "bitcoin"
  | "dogecoin"
  | "eth"
  | "solana"
  | "monero"
  | "crust"
  | "other";

/** options under Crypto → Other */
const OTHER_SUB_OPTIONS: { value: "sui" | "ton"; label: string }[] = [
  { value: "sui", label: "Sui (SUI)" },
  { value: "ton", label: "TON" },
];

/** chains under Crypto → Ethereum (ETH) */
const ETH_CHAIN_OPTIONS: {
  value: "ethereum" | "arbitrum" | "base" | "polygon";
  label: string;
}[] = [
  { value: "ethereum", label: "ETH (Ethereum)" },
  { value: "arbitrum", label: "ETH (Arbitrum)" },
  { value: "base", label: "ETH (Base)" },
  { value: "polygon", label: "ETH (Polygon)" },
];

/** crypto option value -> logo path (top-level and other sub-options) */
const CRYPTO_LOGO_SRC: Partial<
  Record<
    | "bitcoin"
    | "dogecoin"
    | "eth"
    | "solana"
    | "sui"
    | "ton"
    | "monero"
    | "crust"
    | "other",
    string
  >
> = {
  bitcoin: "/crypto/bitcoin/bitcoin-logo.svg",
  dogecoin: "/payments/doge.svg",
  eth: "/crypto/ethereum/ethereum-logo.svg",
  solana: "/crypto/solana/solanaLogoMark.svg",
  sui: "/crypto/sui/sui-logo.svg",
  ton: "/crypto/ton/ton_logo.svg",
  monero: "/crypto/monero/monero-xmr-logo.svg",
  crust: "/crypto/solana/solanaLogoMark.svg",
};

const USDC_SUB_OPTIONS: {
  value: "solana" | "ethereum" | "arbitrum" | "base" | "polygon";
  label: string;
}[] = [
  { value: "solana", label: "USDC (Solana)" },
  { value: "ethereum", label: "USDC (Ethereum)" },
  { value: "arbitrum", label: "USDC (Arbitrum)" },
  { value: "base", label: "USDC (Base)" },
  { value: "polygon", label: "USDC (Polygon)" },
];

/** USDC chain -> logo path (public/crypto or public/payments) */
const USDC_LOGO_SRC: Partial<
  Record<(typeof USDC_SUB_OPTIONS)[number]["value"], string>
> = {
  solana: "/crypto/solana/solanaLogoMark.svg",
  ethereum: "/crypto/ethereum/ethereum-logo.svg",
  arbitrum: "/crypto/ethereum/ethereum-logo.svg",
  base: "/crypto/ethereum/ethereum-logo.svg",
  polygon: "/crypto/ethereum/ethereum-logo.svg",
};

const USDT_SUB_OPTIONS: {
  value: "ethereum" | "arbitrum" | "bnb" | "polygon";
  label: string;
}[] = [
  { value: "ethereum", label: "USDT (Ethereum)" },
  { value: "arbitrum", label: "USDT (Arbitrum)" },
  { value: "bnb", label: "USDT (BNB Smart Chain)" },
  { value: "polygon", label: "USDT (Polygon)" },
];

/** USDT chain -> logo path (public/crypto or public/payments) */
const USDT_LOGO_SRC: Partial<
  Record<(typeof USDT_SUB_OPTIONS)[number]["value"] | "base", string>
> = {
  ethereum: "/crypto/ethereum/ethereum-logo.svg",
  arbitrum: "/crypto/ethereum/ethereum-logo.svg",
  base: "/crypto/ethereum/ethereum-logo.svg",
  polygon: "/crypto/ethereum/ethereum-logo.svg",
  bnb: "/crypto/bnb/bnb-smart-chain.svg",
};

export function CheckoutClient() {
  const { isHydrated, items, subtotal, itemCount } = useCart();
  const { user, isPending: authPending } = useCurrentUser();
  const isLoggedIn = Boolean(user?.email);
  const userReceiveMarketing =
    (user as { receiveMarketing?: boolean } | null)?.receiveMarketing === true;
  const userReceiveSmsMarketing =
    (user as { receiveSmsMarketing?: boolean } | null)?.receiveSmsMarketing ===
    true;
  const [form, setForm] = useState<CheckoutFormState>(() =>
    getPersistedShippingForm(),
  );
  const [emailNews, setEmailNews] = useState(true);

  // When opened from Telegram Mini App (/telegram/checkout or ?source=telegram), prefill email with synthetic value so backend has a valid email
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname ?? "";
    const fromTelegram =
      params.get("source") === "telegram" || pathname.startsWith("/telegram");
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!fromTelegram || !user) return;
    const syntheticEmail = `telegram_${user.id}@telegram.user`;
    setForm((prev) =>
      !prev.email?.trim() || prev.email === syntheticEmail
        ? { ...prev, email: syntheticEmail }
        : prev,
    );
  }, []);
  const [textNews, setTextNews] = useState(false);
  const [useShippingAsBilling, setUseShippingAsBilling] = useState(true);
  const [billingForm, setBillingForm] =
    useState<BillingFormState>(defaultBillingForm);
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
    | "other";
  type UsdcSub = "solana" | "ethereum" | "arbitrum" | "base" | "polygon";
  type UsdtSub = "ethereum" | "arbitrum" | "bnb" | "polygon";

  /** Empty string = no payment method selected (payments closed on first load). */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodTop | "">("");
  /** When paymentMethod === "stablecoins", which token (usdc or usdt). */
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
  const [ethereumNetwork, setEthereumNetwork] = useState<"ethereum" | "base">(
    "ethereum",
  );
  const [cardForm, setCardForm] = useState({
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    cardName: "",
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [cardLogosOpen, setCardLogosOpen] = useState(false);
  const cardLogosCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [loqateSuggestions, setLoqateSuggestions] = useState<LoqateFindItem[]>(
    [],
  );
  const [loqateLoading, setLoqateLoading] = useState(false);
  const [loqateOpen, setLoqateOpen] = useState(false);
  const loqateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextFindRef = useRef(false);
  const loqateWarmedRef = useRef(false);
  const addressContainerRef = useRef<HTMLDivElement | null>(null);
  const [billingLoqateSuggestions, setBillingLoqateSuggestions] = useState<
    LoqateFindItem[]
  >([]);
  const [billingLoqateLoading, setBillingLoqateLoading] = useState(false);
  const [billingLoqateOpen, setBillingLoqateOpen] = useState(false);
  const billingLoqateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const skipNextBillingFindRef = useRef(false);
  const billingAddressContainerRef = useRef<HTMLDivElement | null>(null);
  const [solanaPayOpen, setSolanaPayOpen] = useState(false);
  const [solanaPayUrl, setSolanaPayUrl] = useState<URL | null>(null);
  const [solanaPayOrderId, setSolanaPayOrderId] = useState<string | null>(null);
  const [solanaPayRecipient, setSolanaPayRecipient] = useState<string | null>(
    null,
  );
  const [solanaPayAmount, setSolanaPayAmount] = useState<BigNumber | null>(
    null,
  );
  const [solanaPaySplToken, setSolanaPaySplToken] = useState<string | null>(
    null,
  );
  const [solanaPayStatus, setSolanaPayStatus] = useState<
    "idle" | "pending" | "confirmed" | "error" | "connection-error"
  >("idle");
  const solanaPayPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrContainerRef = useRef<HTMLDivElement | null>(null);
  const [shippingCents, setShippingCents] = useState<number>(0);
  const [shippingLabel, setShippingLabel] = useState<string | null>(null);
  const [shippingFree, setShippingFree] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingSpeed, setShippingSpeed] = useState<"standard" | "express">(
    "standard",
  );
  const [canShipToCountry, setCanShipToCountry] = useState(true);
  const [navigatingToPay, setNavigatingToPay] = useState(false);
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    couponId: string;
    code: string;
    discountKind: string;
    discountType: string;
    discountValue: number;
    discountCents: number;
    freeShipping: boolean;
    totalAfterDiscountCents: number;
  } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [showDiscountCode, setShowDiscountCode] = useState(false);
  const router = useRouter();
  const isUS = form.country === "US";
  const isBillingUS = billingForm.country === "US";

  const EVM_CHAINS = ["ethereum", "arbitrum", "base", "polygon"] as const;
  const EVM_CHAINS_AND_BNB = [
    "ethereum",
    "arbitrum",
    "base",
    "polygon",
    "bnb",
  ] as const;

  const { visibility } = usePaymentMethodSettings();
  const hiddenOptions = useMemo(
    () =>
      visibility
        ? getHiddenFromVisibility(visibility)
        : HIDDEN_PAYMENT_OPTIONS,
    [visibility],
  );
  const solanaPayConfigured = Boolean(getSolanaPayRecipient());
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
  const visibleUsdcSubOptions = useMemo(
    () =>
      USDC_SUB_OPTIONS.filter(
        (opt) => opt.value !== "solana" || solanaPayConfigured,
      ),
    [solanaPayConfigured],
  );
  const isSolanaPaySupported =
    solanaPayConfigured &&
    ((paymentMethod === "stablecoins" && stablecoinToken === "usdc" && paymentSubOption === "solana") ||
      (paymentMethod === "crypto" && paymentSubOption === "crust") ||
      (paymentMethod === "crypto" && paymentSubOption === "solana"));

  const isEvmPaySupported =
    (paymentMethod === "crypto" &&
      paymentSubOption === "eth" &&
      EVM_CHAINS.includes(cryptoEthChain)) ||
    (paymentMethod === "stablecoins" && stablecoinToken === "usdc" &&
      EVM_CHAINS.includes(paymentSubOption as (typeof EVM_CHAINS)[number])) ||
    (paymentMethod === "stablecoins" && stablecoinToken === "usdt" &&
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

  const openSolanaPayDialog = useCallback(async () => {
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
    const discountCentsForOrder = appliedCoupon?.discountCents ?? 0;
    const shippingFeeCentsRounded = Math.round(shippingCents);
    const orderTotalCents =
      subtotalCents - discountCentsForOrder + shippingFeeCentsRounded;
    setSolanaPayStatus("pending");
    try {
      const createRes = await fetch("/api/checkout/solana-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email?.trim() || "guest@checkout.local",
          orderItems,
          totalCents: orderTotalCents,
          shippingFeeCents: shippingFeeCentsRounded,
          userId: user?.id ?? null,
          emailMarketingConsent:
            isLoggedIn && userReceiveMarketing ? true : emailNews,
          smsMarketingConsent:
            isLoggedIn && userReceiveSmsMarketing ? true : textNews,
          ...getTelegramOrderPayload(),
          ...getAffiliatePayload(),
          ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        }),
      });
      if (!createRes.ok) {
        setSolanaPayStatus("error");
        return;
      }
      const data = (await createRes.json()) as {
        orderId: string;
        depositAddress: string;
      };
      const { orderId, depositAddress } = data;
      const amount = usdcAmountFromUsd(orderTotalCents / 100);
      const url = encodeURL({
        recipient: new PublicKey(depositAddress),
        amount,
        splToken: new PublicKey(USDC_MINT_MAINNET),
        label: getSolanaPayLabel(),
        message: `Order total: $${(subtotal + shippingCents / 100).toFixed(2)}`,
      });
      setSolanaPayUrl(url);
      setSolanaPayOrderId(orderId);
      setSolanaPayRecipient(depositAddress);
      setSolanaPayAmount(amount);
      setSolanaPaySplToken(USDC_MINT_MAINNET);
      setSolanaPayOpen(true);
    } catch {
      setSolanaPayStatus("error");
    }
  }, [
    subtotal,
    shippingCents,
    items,
    form.email,
    user?.id,
    emailNews,
    textNews,
    isLoggedIn,
    userReceiveMarketing,
    userReceiveSmsMarketing,
    appliedCoupon,
  ]);

  const closeSolanaPayDialog = useCallback(() => {
    setSolanaPayOpen(false);
    if (solanaPayPollRef.current) {
      clearInterval(solanaPayPollRef.current);
      solanaPayPollRef.current = null;
    }
    setSolanaPayUrl(null);
    setSolanaPayOrderId(null);
    setSolanaPayRecipient(null);
    setSolanaPayAmount(null);
    setSolanaPaySplToken(null);
    setSolanaPayStatus("idle");
    if (qrContainerRef.current) qrContainerRef.current.innerHTML = "";
  }, []);

  // persist shipping form: restore from localStorage on mount and when returning (back from payment / Change / bfcache).
  // do not remove — data must persist until successful checkout.
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

  // Auto-fill shipping first name, last name, and email from logged-in user when fields are empty
  useEffect(() => {
    const u = user as {
      email?: string;
      firstName?: string;
      lastName?: string;
    } | null;
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

  // dynamic shipping: recalc when country, cart, or subtotal changes (with timeout so slow API doesn't block UI)
  // Also includes address fields for more accurate fulfillment shipping rates
  const SHIPPING_CALCULATE_TIMEOUT_MS = 15_000;
  useEffect(() => {
    const country = form.country?.trim();
    if (!country || items.length === 0) {
      setShippingCents(0);
      setShippingLabel(null);
      setShippingFree(false);
      setShippingLoading(false);
      setCanShipToCountry(true);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    const timeoutId = setTimeout(
      () => ac.abort(),
      SHIPPING_CALCULATE_TIMEOUT_MS,
    );
    setShippingLoading(true);
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
        // Additional fields for more accurate fulfillment shipping rates
        stateCode: form.state?.trim() || undefined,
        city: form.city?.trim() || undefined,
        zip: form.zip?.trim() || undefined,
        address1: form.street?.trim() || undefined,
        // When a free_shipping coupon is applied, backend returns 0 shipping
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
          adminShippingCents?: number;
          shippingSpeed?: "standard" | "express";
        }) => {
          if (!cancelled) {
            setShippingCents(
              typeof data.shippingCents === "number" ? data.shippingCents : 0,
            );
            setShippingLabel(data.label ?? null);
            setShippingFree(Boolean(data.freeShipping));
            setCanShipToCountry(data.canShipToCountry !== false);
            setShippingSpeed(
              data.shippingSpeed === "express" ? "express" : "standard",
            );
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
  ]);

  const discountCents = appliedCoupon?.discountCents ?? 0;
  const totalCents =
    Math.round(subtotal * 100) - discountCents + shippingCents;
  const total = Math.max(0, totalCents) / 100;

  const handleApplyCoupon = useCallback(async () => {
    const code = discountCodeInput.trim();
    if (!code) return;
    setCouponError("");
    setCouponLoading(true);
    try {
      const res = await fetch("/api/checkout/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          subtotalCents: Math.round(subtotal * 100),
          shippingFeeCents: Math.round(shippingCents),
          productIds: items.map((i) => i.productId ?? i.id),
        }),
      });
      const data = (await res.json()) as
        | { valid: true; couponId: string; code: string; discountKind: string; discountType: string; discountValue: number; discountCents: number; freeShipping: boolean; totalAfterDiscountCents: number }
        | { valid: false; error?: string };
      if (data.valid) {
        setAppliedCoupon({
          couponId: data.couponId,
          code: data.code,
          discountKind: data.discountKind,
          discountType: data.discountType,
          discountValue: data.discountValue,
          discountCents: data.discountCents,
          freeShipping: data.freeShipping,
          totalAfterDiscountCents: data.totalAfterDiscountCents,
        });
        setDiscountCodeInput("");
      } else {
        setCouponError(
          typeof data.error === "string" && data.error.length > 0
            ? data.error
            : "This discount code is invalid or expired.",
        );
      }
    } catch {
      setCouponError("Could not validate discount code. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  }, [discountCodeInput, subtotal, shippingCents, items]);

  // attach QR code to container when Solana Pay dialog opens (delay so dialog DOM is mounted and visible)
  useEffect(() => {
    if (!solanaPayOpen || !solanaPayUrl) return;
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      const container = qrContainerRef.current;
      if (!container) return;
      // Clear previous QR code using DOM methods (safer than innerHTML)
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      const qr = createQR(solanaPayUrl.toString(), 256, "white", "black");
      qr.append(container);
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      // Clear QR code on cleanup using DOM methods
      if (qrContainerRef.current) {
        while (qrContainerRef.current.firstChild) {
          qrContainerRef.current.removeChild(qrContainerRef.current.firstChild);
        }
      }
    };
  }, [solanaPayOpen, solanaPayUrl]);

  // poll for Solana Pay transaction confirmation (server-side RPC avoids browser CORS)
  useEffect(() => {
    if (
      !solanaPayOpen ||
      !solanaPayRecipient ||
      !solanaPayAmount ||
      !solanaPaySplToken
    )
      return;
    const params = new URLSearchParams({
      depositAddress: solanaPayRecipient,
      amount: solanaPayAmount.toString(),
      splToken: solanaPaySplToken,
    });
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/solana-pay/status?${params.toString()}`,
        );
        const data = (await res.json()) as {
          status: string;
          message?: string;
          signature?: string;
        };
        if (data.status === "confirmed") {
          setSolanaPayStatus("confirmed");
          if (solanaPayPollRef.current) {
            clearInterval(solanaPayPollRef.current);
            solanaPayPollRef.current = null;
          }
          const orderId = solanaPayOrderId;
          const depositAddress = solanaPayRecipient;
          closeSolanaPayDialog();
          try {
            await fetch("/api/checkout/solana-pay/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                depositAddress,
                orderId,
                signature: data.signature,
                amount: solanaPayAmount.toString(),
                splToken: solanaPaySplToken,
              }),
            });
          } catch {
            // order stays pending; can be reconciled later
          }
          router.push(
            orderId
              ? `/checkout/success?orderId=${encodeURIComponent(orderId)}`
              : "/checkout/success",
          );
          return;
        }
        if (data.status === "error") {
          setSolanaPayStatus("error");
          if (solanaPayPollRef.current) {
            clearInterval(solanaPayPollRef.current);
            solanaPayPollRef.current = null;
          }
          return;
        }
        // status === "pending" -> keep polling
      } catch {
        setSolanaPayStatus("connection-error");
        if (solanaPayPollRef.current) {
          clearInterval(solanaPayPollRef.current);
          solanaPayPollRef.current = null;
        }
      }
    }, 1500);
    solanaPayPollRef.current = interval;
    return () => {
      if (solanaPayPollRef.current) {
        clearInterval(solanaPayPollRef.current);
        solanaPayPollRef.current = null;
      }
    };
  }, [
    solanaPayOpen,
    solanaPayOrderId,
    solanaPayRecipient,
    solanaPayAmount,
    solanaPaySplToken,
    router,
    closeSolanaPayDialog,
  ]);

  const update = (field: keyof CheckoutFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateBilling = (field: keyof BillingFormState, value: string) => {
    setBillingForm((prev) => ({ ...prev, [field]: value }));
  };

  // Loqate address autocomplete: debounced Find when shipping street/country change (with timeout so 503/slow API doesn't hang)
  const LOQATE_FIND_TIMEOUT_MS = 10_000;
  useEffect(() => {
    const text = form.street?.trim() ?? "";
    if (text.length < 2) {
      setLoqateSuggestions([]);
      setLoqateOpen(false);
      return;
    }
    if (loqateDebounceRef.current) clearTimeout(loqateDebounceRef.current);
    loqateDebounceRef.current = setTimeout(() => {
      loqateDebounceRef.current = null;
      if (skipNextFindRef.current) {
        skipNextFindRef.current = false;
        return;
      }
      setLoqateLoading(true);
      const params = new URLSearchParams({ text, limit: "6" });
      if (form.country?.trim()) params.set("countries", form.country.trim());
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), LOQATE_FIND_TIMEOUT_MS);
      fetch(`/api/loqate/find?${params.toString()}`, { signal: ac.signal })
        .then((res) => (res.ok ? res.json() : { Items: [] }))
        .then((data: { Items?: LoqateFindItem[] }) => {
          setLoqateSuggestions(data.Items ?? []);
          setLoqateOpen((data.Items?.length ?? 0) > 0);
        })
        .catch(() => setLoqateSuggestions([]))
        .finally(() => {
          clearTimeout(timeoutId);
          setLoqateLoading(false);
        });
    }, 300);
    return () => {
      if (loqateDebounceRef.current) clearTimeout(loqateDebounceRef.current);
    };
  }, [form.street, form.country]);

  const onSelectLoqateAddress = useCallback((id: string) => {
    setLoqateLoading(true);
    fetch(`/api/loqate/retrieve?id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Retrieve failed");
        return res.json();
      })
      .then((addr) => {
        const mapped = mapRetrieveToShipping(addr);
        setForm((prev) => ({
          ...prev,
          street: mapped.street,
          apartment: mapped.apartment || prev.apartment,
          city: mapped.city,
          state: mapped.state,
          zip: mapped.zip,
          country: mapped.country || prev.country,
        }));
        skipNextFindRef.current = true;
        setLoqateOpen(false);
        setLoqateSuggestions([]);
      })
      .catch(() => {})
      .finally(() => setLoqateLoading(false));
  }, []);

  // Loqate for billing address (when billing differs from shipping)
  useEffect(() => {
    if (useShippingAsBilling) {
      setBillingLoqateSuggestions([]);
      setBillingLoqateOpen(false);
      return;
    }
    const text = billingForm.street?.trim() ?? "";
    if (text.length < 2) {
      setBillingLoqateSuggestions([]);
      setBillingLoqateOpen(false);
      return;
    }
    if (billingLoqateDebounceRef.current)
      clearTimeout(billingLoqateDebounceRef.current);
    billingLoqateDebounceRef.current = setTimeout(() => {
      billingLoqateDebounceRef.current = null;
      if (skipNextBillingFindRef.current) {
        skipNextBillingFindRef.current = false;
        return;
      }
      setBillingLoqateLoading(true);
      const params = new URLSearchParams({ text, limit: "6" });
      if (billingForm.country?.trim())
        params.set("countries", billingForm.country.trim());
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), LOQATE_FIND_TIMEOUT_MS);
      fetch(`/api/loqate/find?${params.toString()}`, { signal: ac.signal })
        .then((res) => (res.ok ? res.json() : { Items: [] }))
        .then((data: { Items?: LoqateFindItem[] }) => {
          setBillingLoqateSuggestions(data.Items ?? []);
          setBillingLoqateOpen((data.Items?.length ?? 0) > 0);
        })
        .catch(() => setBillingLoqateSuggestions([]))
        .finally(() => {
          clearTimeout(timeoutId);
          setBillingLoqateLoading(false);
        });
    }, 300);
    return () => {
      if (billingLoqateDebounceRef.current)
        clearTimeout(billingLoqateDebounceRef.current);
    };
  }, [useShippingAsBilling, billingForm.street, billingForm.country]);

  const onSelectBillingLoqateAddress = useCallback((id: string) => {
    setBillingLoqateLoading(true);
    fetch(`/api/loqate/retrieve?id=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Retrieve failed");
        return res.json();
      })
      .then((addr) => {
        const mapped = mapRetrieveToShipping(addr);
        setBillingForm((prev) => ({
          ...prev,
          street: mapped.street,
          apartment: mapped.apartment || prev.apartment,
          city: mapped.city,
          state: mapped.state,
          zip: mapped.zip,
          country: mapped.country || prev.country,
        }));
        skipNextBillingFindRef.current = true;
        setBillingLoqateOpen(false);
        setBillingLoqateSuggestions([]);
      })
      .catch(() => {})
      .finally(() => setBillingLoqateLoading(false));
  }, []);

  const validateShipping = useCallback((): string[] => {
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
    if (
      shippingSpeed === "express" &&
      !form.phone?.trim()
    ) {
      err.push("Phone number is required for Express shipping");
    }
    return err;
  }, [
    form.country,
    form.firstName,
    form.lastName,
    form.street,
    form.city,
    form.zip,
    form.state,
    form.phone,
    shippingSpeed,
  ]);

  const validateBilling = useCallback((): string[] => {
    const err: string[] = [];
    if (!billingForm.country?.trim()) err.push("Billing country is required");
    if (!billingForm.firstName?.trim())
      err.push("Billing first name is required");
    if (!billingForm.lastName?.trim())
      err.push("Billing last name is required");
    if (!billingForm.street?.trim()) err.push("Billing address is required");
    return err;
  }, [
    billingForm.country,
    billingForm.firstName,
    billingForm.lastName,
    billingForm.street,
  ]);

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

  const handlePlaceOrder = useCallback(() => {
    const shippingErr = validateShipping();
    const billingErr = !useShippingAsBilling ? validateBilling() : [];
    const cardErr = paymentMethod === "credit-card" ? validateCreditCard() : [];
    const all = [...shippingErr, ...billingErr, ...cardErr];
    setValidationErrors(all);
    if (all.length === 0) {
      setNavigatingToPay(true);
      requestAnimationFrame(() => router.push("/checkout/success"));
    }
  }, [
    paymentMethod,
    useShippingAsBilling,
    validateShipping,
    validateBilling,
    validateCreditCard,
    router,
  ]);

  const setPaymentTop = useCallback((method: PaymentMethodTop) => {
    setPaymentMethod(method);
    setValidationErrors([]);
    if (method === "crypto") {
      setPaymentSubOption(""); // leave crypto sub-option unchecked so user picks one explicitly
      setCryptoOtherSubOption("");
    } else if (method === "stablecoins") {
      setStablecoinToken("usdc");
      setPaymentSubOption("solana" as UsdcSub);
    }
  }, []);

  const handlePayWithSolana = useCallback(() => {
    const shippingErr = validateShipping();
    const billingErr = !useShippingAsBilling ? validateBilling() : [];
    const all = [...shippingErr, ...billingErr];
    setValidationErrors(all);
    if (all.length > 0) return;
    openSolanaPayDialog();
  }, [
    validateShipping,
    validateBilling,
    useShippingAsBilling,
    openSolanaPayDialog,
  ]);

  const handleGoToCryptoPay = useCallback(async () => {
    const shippingErr = validateShipping();
    const billingErr = !useShippingAsBilling ? validateBilling() : [];
    const all = [...shippingErr, ...billingErr];
    setValidationErrors(all);
    if (all.length > 0) return;
    setNavigatingToPay(true);
    persistShippingForm(form);
    const isSui = paymentMethod === "crypto" && cryptoOtherSubOption === "sui";
    if (isSui) {
      // Sui is its own chain; no Solana order. Put amount/expires in hash (not query).
      const invoiceId = crypto.randomUUID();
      const amount = total;
      const expires = Date.now() + 60 * 60 * 1000;
      const url = `/checkout/${invoiceId}#sui-${amount.toFixed(2)}-${expires}`;
      router.push(url);
      return;
    }
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
    const discountCentsForOrder = appliedCoupon?.discountCents ?? 0;
    const shippingCentsRounded = Math.round(shippingCents);
    const orderTotalCents =
      subtotalCents - discountCentsForOrder + shippingCentsRounded;
    const emailRaw = form.email?.trim();
    const emailValid =
      typeof emailRaw === "string" &&
      emailRaw.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    const email = emailValid ? emailRaw : "guest@checkout.local";
    try {
      const createRes = await fetch("/api/checkout/solana-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          orderItems,
          totalCents: orderTotalCents,
          shippingFeeCents: shippingCentsRounded,
          userId: user?.id ?? null,
          emailMarketingConsent:
            isLoggedIn && userReceiveMarketing ? true : emailNews,
          smsMarketingConsent:
            isLoggedIn && userReceiveSmsMarketing ? true : textNews,
          ...getTelegramOrderPayload(),
          ...getAffiliatePayload(),
          ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        }),
      });
      if (!createRes.ok) {
        setNavigatingToPay(false);
        const body = (await createRes.json().catch(() => ({}))) as {
          error?: string;
        };
        const message =
          typeof body?.error === "string" && body.error.length > 0
            ? body.error
            : "Could not create order. Please try again.";
        setValidationErrors([message]);
        return;
      }
      const data = (await createRes.json()) as { orderId: string };
      const token =
        (paymentMethod === "crypto" && paymentSubOption === "crust")
          ? "crust"
          : paymentMethod === "stablecoins" && stablecoinToken === "usdc" && paymentSubOption === "solana"
            ? "usdc"
            : "solana";
      const url = `/checkout/${data.orderId}#${token}`;
      router.push(url);
    } catch {
      setNavigatingToPay(false);
      setValidationErrors(["Could not create order. Please try again."]);
    }
  }, [
    form,
    user?.id,
    validateShipping,
    validateBilling,
    useShippingAsBilling,
    subtotal,
    shippingCents,
    items,
    total,
    paymentMethod,
    paymentSubOption,
    cryptoOtherSubOption,
    router,
    emailNews,
    textNews,
    isLoggedIn,
    userReceiveMarketing,
    userReceiveSmsMarketing,
    appliedCoupon,
  ]);

  const handleGoToBtcPay = useCallback(async () => {
    const shippingErr = validateShipping();
    const billingErr = !useShippingAsBilling ? validateBilling() : [];
    const all = [...shippingErr, ...billingErr];
    setValidationErrors(all);
    if (all.length > 0) return;
    setNavigatingToPay(true);
    persistShippingForm(form);
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
    const discountCentsForOrder = appliedCoupon?.discountCents ?? 0;
    const shippingCentsRounded = Math.round(shippingCents);
    const orderTotalCents =
      subtotalCents - discountCentsForOrder + shippingCentsRounded;
    const emailRaw = form.email?.trim();
    const emailValid =
      typeof emailRaw === "string" &&
      emailRaw.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    const email = emailValid ? emailRaw : "guest@checkout.local";
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
        body: JSON.stringify({
          email: email.toLowerCase(),
          orderItems,
          totalCents: orderTotalCents,
          shippingFeeCents: shippingCentsRounded,
          userId: user?.id ?? null,
          token,
          emailMarketingConsent:
            isLoggedIn && userReceiveMarketing ? true : emailNews,
          smsMarketingConsent:
            isLoggedIn && userReceiveSmsMarketing ? true : textNews,
          ...getTelegramOrderPayload(),
          ...getAffiliatePayload(),
          ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        }),
      });
      if (!createRes.ok) {
        setNavigatingToPay(false);
        const body = (await createRes.json().catch(() => ({}))) as {
          error?: string;
        };
        const message =
          typeof body?.error === "string" && body.error.length > 0
            ? body.error
            : "Could not create order. Please try again.";
        setValidationErrors([message]);
        return;
      }
      const data = (await createRes.json()) as { orderId: string };
      const url = `/checkout/${data.orderId}#${token}`;
      router.push(url);
    } catch {
      setNavigatingToPay(false);
      setValidationErrors(["Could not create order. Please try again."]);
    }
  }, [
    form,
    user?.id,
    validateShipping,
    validateBilling,
    useShippingAsBilling,
    shippingCents,
    items,
    total,
    paymentSubOption,
    router,
    emailNews,
    textNews,
    isLoggedIn,
    userReceiveMarketing,
    userReceiveSmsMarketing,
  ]);

  const handleGoToEthPay = useCallback(async () => {
    const shippingErr = validateShipping();
    const billingErr = !useShippingAsBilling ? validateBilling() : [];
    const all = [...shippingErr, ...billingErr];
    setValidationErrors(all);
    if (all.length > 0) return;
    setNavigatingToPay(true);
    persistShippingForm(form);
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
    const discountCentsForOrder = appliedCoupon?.discountCents ?? 0;
    const shippingFeeCentsRounded = Math.round(shippingCents);
    const orderTotalCents =
      subtotalCents - discountCentsForOrder + shippingFeeCentsRounded;
    try {
      // Create order via API
      const res = await fetch("/api/checkout/eth-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user?.email ?? form.email ?? "",
          orderItems: orderItems.map(
            ({ productId, productVariantId, quantity }) => ({
              productId,
              ...(productVariantId && { productVariantId }),
              quantity,
            }),
          ),
          totalCents: Math.round(orderTotalCents),
          shippingFeeCents: shippingFeeCentsRounded,
          chain,
          token,
          userId: user?.id,
          emailMarketingConsent:
            isLoggedIn && userReceiveMarketing ? true : emailNews,
          smsMarketingConsent:
            isLoggedIn && userReceiveSmsMarketing ? true : textNews,
          ...getTelegramOrderPayload(),
          ...getAffiliatePayload(),
          ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
          shipping: {
            name: `${form.firstName} ${form.lastName}`.trim(),
            address1: form.street,
            address2: form.apartment,
            city: form.city,
            stateCode: form.state,
            countryCode: form.country,
            zip: form.zip,
            phone: form.phone,
          },
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as {
          error?: string;
          expectedTotalCents?: number;
          receivedTotalCents?: number;
          subtotalCents?: number;
          shippingCents?: number;
          productNames?: string[];
          productPriceCents?: Array<{
            name: string;
            priceCents: number;
            quantity: number;
          }>;
        };
        const msg = data.error ?? "Failed to create order";
        let hint = "";
        if (typeof data.expectedTotalCents === "number") {
          hint = ` Expected total: $${(data.expectedTotalCents / 100).toFixed(2)}.`;
          if (
            typeof data.subtotalCents === "number" &&
            typeof data.shippingCents === "number"
          ) {
            hint += ` Backend computed: subtotal $${(data.subtotalCents / 100).toFixed(2)} + shipping $${(data.shippingCents / 100).toFixed(2)} = $${(data.expectedTotalCents / 100).toFixed(2)}.`;
          }
          if (
            Array.isArray(data.productPriceCents) &&
            data.productPriceCents.length > 0
          ) {
            const lines = data.productPriceCents.map(
              (p) =>
                ` ${p.name}: $${(p.priceCents / 100).toFixed(2)} × ${p.quantity}`,
            );
            hint += ` Backend matched:${lines.join(";")}.`;
          }
          hint +=
            " If your cart shows different prices, product data may have changed—refresh and try again.";
        }
        throw new Error(msg + hint);
      }

      const { orderId } = await res.json();

      // Navigate to payment page with clean URL: /checkout/{orderId}#eth
      const url = `/checkout/${orderId}#${token}`;
      requestAnimationFrame(() => {
        router.push(url);
      });
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
    form,
    user?.email,
    user?.id,
    validateShipping,
    validateBilling,
    useShippingAsBilling,
    total,
    shippingCents,
    items,
    paymentMethod,
    paymentSubOption,
    stablecoinToken,
    cryptoEthChain,
    router,
    emailNews,
    textNews,
    isLoggedIn,
    userReceiveMarketing,
    userReceiveSmsMarketing,
  ]);

  const handleGoToTonPay = useCallback(async () => {
    const shippingErr = validateShipping();
    const billingErr = !useShippingAsBilling ? validateBilling() : [];
    const all = [...shippingErr, ...billingErr];
    setValidationErrors(all);
    if (all.length > 0) return;
    setNavigatingToPay(true);
    persistShippingForm(form);
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
    const discountCentsForOrder = appliedCoupon?.discountCents ?? 0;
    const shippingCentsRounded = Math.round(shippingCents);
    const orderTotalCents =
      subtotalCents - discountCentsForOrder + shippingCentsRounded;
    const emailRaw = form.email?.trim();
    const emailValid =
      typeof emailRaw === "string" &&
      emailRaw.length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    const email = emailValid ? emailRaw : "guest@checkout.local";
    try {
      const createRes = await fetch("/api/checkout/ton-pay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase(),
          orderItems: orderItems.map(
            ({ productId, productVariantId, quantity }) => ({
              productId,
              ...(productVariantId && { productVariantId }),
              quantity,
            }),
          ),
          totalCents: Math.round(orderTotalCents),
          shippingFeeCents: shippingCentsRounded,
          userId: user?.id ?? null,
          emailMarketingConsent:
            isLoggedIn && userReceiveMarketing ? true : emailNews,
          smsMarketingConsent:
            isLoggedIn && userReceiveSmsMarketing ? true : textNews,
          ...getTelegramOrderPayload(),
          ...getAffiliatePayload(),
          ...(appliedCoupon?.code ? { couponCode: appliedCoupon.code } : {}),
        }),
      });
      if (!createRes.ok) {
        setNavigatingToPay(false);
        const body = (await createRes.json().catch(() => ({}))) as {
          error?: string;
        };
        const message =
          typeof body?.error === "string" && body.error.length > 0
            ? body.error
            : "Could not create order. Please try again.";
        setValidationErrors([message]);
        return;
      }
      const data = (await createRes.json()) as { orderId: string };
      router.push(`/checkout/${data.orderId}#ton`);
    } catch {
      setNavigatingToPay(false);
      setValidationErrors(["Could not create order. Please try again."]);
    }
  }, [
    form,
    user?.id,
    validateShipping,
    validateBilling,
    useShippingAsBilling,
    shippingCents,
    items,
    router,
    emailNews,
    textNews,
    isLoggedIn,
    userReceiveMarketing,
    userReceiveSmsMarketing,
    appliedCoupon,
  ]);

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
        <div className="grid gap-8 pt-4 sm:grid-cols-[1fr,340px] md:grid-cols-[1fr,380px] lg:grid-cols-[1fr,400px]">
          {/* Left: contact, address, shipping method, payment, place order + policy links */}
          <div className="min-w-0 space-y-6 sm:col-start-1">
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

            {/* Shipping address — country first, then names, address, etc. */}
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
                    {COUNTRY_OPTIONS.map((opt) => (
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
                    aria-invalid={validationErrors.includes(
                      "First name is required",
                    )}
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
                    aria-invalid={validationErrors.includes(
                      "Last name is required",
                    )}
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
                  ref={addressContainerRef}
                >
                  <Input
                    aria-label="Address"
                    aria-autocomplete="list"
                    aria-expanded={loqateOpen}
                    aria-invalid={validationErrors.includes(
                      "Address is required",
                    )}
                    className={cn(
                      checkoutFieldHeight,
                      validationErrors.includes("Address is required") &&
                        "border-destructive",
                    )}
                    placeholder="Address"
                    value={form.street}
                    onChange={(e) => update("street", e.target.value)}
                    onFocus={() => {
                      if (loqateSuggestions.length > 0) setLoqateOpen(true);
                      // One-time warm-up: prefetch so first real request reuses connection
                      if (!loqateWarmedRef.current) {
                        loqateWarmedRef.current = true;
                        fetch("/api/loqate/find?text=a&limit=1").catch(() => {});
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setLoqateOpen(false), 200);
                    }}
                  />
                  {loqateOpen &&
                    (loqateSuggestions.length > 0 || loqateLoading) && (
                      <div
                        className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg"
                        role="listbox"
                      >
                        {loqateLoading && loqateSuggestions.length === 0 ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                            <Loader2
                              className="h-4 w-4 animate-spin shrink-0"
                              aria-hidden
                            />
                            Finding addresses…
                          </div>
                        ) : (
                          loqateSuggestions
                            .filter((item) => item.Type === "Address")
                            .map((item) => (
                              <button
                                key={item.Id}
                                type="button"
                                className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                                role="option"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  onSelectLoqateAddress(item.Id);
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
                {/* desktop: city, state, zip on one row */}
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                  <div>
                    <Input
                      aria-label="City"
                      aria-invalid={validationErrors.includes(
                        "City is required",
                      )}
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
                          validationErrors.includes(
                            "Postal code is required",
                          )) &&
                          "border-destructive",
                      )}
                      placeholder={isUS ? "ZIP code" : "Postal code"}
                      value={form.zip}
                      onChange={(e) => update("zip", e.target.value)}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <Input
                    aria-label="Phone"
                    aria-required={shippingSpeed === "express"}
                    className={cn(checkoutFieldHeight, "flex-1 min-w-0")}
                    placeholder={
                      shippingSpeed === "express"
                        ? "Phone (required for Express shipping)"
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

            {/* Shipping method — driven by admin shipping options (single result from API) */}
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Shipping method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-md border border-border p-3">
                  <span className="text-sm font-medium">
                    {shippingLoading
                      ? "Calculating…"
                      : (shippingLabel ?? "Shipping")}
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

            {/* Payment */}
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Payment</CardTitle>
                <CardDescription>
                  All transactions are secure and encrypted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Credit card (Stripe) — hidden when hiddenOptions.creditCard */}
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
                                  clearTimeout(
                                    cardLogosCloseTimeoutRef.current,
                                  );
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
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={useShippingAsBilling}
                            onCheckedChange={(v) =>
                              setUseShippingAsBilling(v === true)
                            }
                          />
                          <span>Use shipping address as billing address</span>
                        </label>
                        {!useShippingAsBilling && (
                          <div className="space-y-4 border-t border-border pt-4">
                            <h3 className="font-semibold">Billing address</h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <select
                                  aria-label="Country/Region"
                                  aria-invalid={validationErrors.includes(
                                    "Billing country is required",
                                  )}
                                  value={billingForm.country}
                                  onChange={(e) =>
                                    updateBilling("country", e.target.value)
                                  }
                                  className={cn(
                                    selectInputClass,
                                    validationErrors.includes(
                                      "Billing country is required",
                                    ) && "border-destructive",
                                  )}
                                >
                                  {COUNTRY_OPTIONS.map((opt) => (
                                    <option
                                      key={opt.value || "empty"}
                                      value={opt.value}
                                    >
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <Input
                                  aria-label="First name (billing)"
                                  aria-invalid={validationErrors.includes(
                                    "Billing first name is required",
                                  )}
                                  className={cn(
                                    checkoutFieldHeight,
                                    validationErrors.includes(
                                      "Billing first name is required",
                                    ) && "border-destructive",
                                  )}
                                  placeholder="First name"
                                  value={billingForm.firstName}
                                  onChange={(e) =>
                                    updateBilling("firstName", e.target.value)
                                  }
                                />
                              </div>
                              <div>
                                <Input
                                  aria-label="Last name (billing)"
                                  aria-invalid={validationErrors.includes(
                                    "Billing last name is required",
                                  )}
                                  className={cn(
                                    checkoutFieldHeight,
                                    validationErrors.includes(
                                      "Billing last name is required",
                                    ) && "border-destructive",
                                  )}
                                  placeholder="Last name"
                                  value={billingForm.lastName}
                                  onChange={(e) =>
                                    updateBilling("lastName", e.target.value)
                                  }
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <Input
                                  aria-label="Company (optional)"
                                  className={checkoutFieldHeight}
                                  placeholder="Company (optional)"
                                  value={billingForm.company}
                                  onChange={(e) =>
                                    updateBilling("company", e.target.value)
                                  }
                                />
                              </div>
                              <div
                                className="relative sm:col-span-2"
                                ref={billingAddressContainerRef}
                              >
                                <Input
                                  aria-label="Address (billing)"
                                  aria-autocomplete="list"
                                  aria-expanded={billingLoqateOpen}
                                  aria-invalid={validationErrors.includes(
                                    "Billing address is required",
                                  )}
                                  className={cn(
                                    checkoutFieldHeight,
                                    validationErrors.includes(
                                      "Billing address is required",
                                    ) && "border-destructive",
                                  )}
                                  placeholder="Address"
                                  value={billingForm.street}
                                  onChange={(e) =>
                                    updateBilling("street", e.target.value)
                                  }
                                  onFocus={() => {
                                    if (billingLoqateSuggestions.length > 0)
                                      setBillingLoqateOpen(true);
                                    if (!loqateWarmedRef.current) {
                                      loqateWarmedRef.current = true;
                                      fetch(
                                        "/api/loqate/find?text=a&limit=1",
                                      ).catch(() => {});
                                    }
                                  }}
                                  onBlur={() => {
                                    setTimeout(
                                      () => setBillingLoqateOpen(false),
                                      200,
                                    );
                                  }}
                                />
                                {billingLoqateOpen &&
                                  (billingLoqateSuggestions.length > 0 ||
                                    billingLoqateLoading) && (
                                    <div
                                      className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-background shadow-lg"
                                      role="listbox"
                                    >
                                      {billingLoqateLoading &&
                                      billingLoqateSuggestions.length === 0 ? (
                                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                                          <Loader2
                                            className="h-4 w-4 animate-spin shrink-0"
                                            aria-hidden
                                          />
                                          Finding addresses…
                                        </div>
                                      ) : (
                                        billingLoqateSuggestions
                                          .filter(
                                            (item) => item.Type === "Address",
                                          )
                                          .map((item) => (
                                            <button
                                              key={item.Id}
                                              type="button"
                                              className="w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                                              role="option"
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                onSelectBillingLoqateAddress(
                                                  item.Id,
                                                );
                                              }}
                                            >
                                              <span className="font-medium">
                                                {item.Text}
                                              </span>
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
                                  value={billingForm.apartment}
                                  onChange={(e) =>
                                    updateBilling("apartment", e.target.value)
                                  }
                                />
                              </div>
                              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                                <div>
                                  <Input
                                    aria-label="City (billing)"
                                    className={checkoutFieldHeight}
                                    placeholder="City"
                                    value={billingForm.city}
                                    onChange={(e) =>
                                      updateBilling("city", e.target.value)
                                    }
                                  />
                                </div>
                                {isBillingUS ? (
                                  <div>
                                    <select
                                      aria-label="State (billing)"
                                      value={billingForm.state}
                                      onChange={(e) =>
                                        updateBilling("state", e.target.value)
                                      }
                                      className={selectInputClass}
                                    >
                                      {US_STATE_OPTIONS.map((opt) => (
                                        <option
                                          key={opt.value || "empty"}
                                          value={opt.value}
                                        >
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                ) : (
                                  <div>
                                    <Input
                                      aria-label="State / Province (billing)"
                                      className={checkoutFieldHeight}
                                      placeholder="State / Province"
                                      value={billingForm.state}
                                      onChange={(e) =>
                                        updateBilling("state", e.target.value)
                                      }
                                    />
                                  </div>
                                )}
                                <div>
                                  <Input
                                    aria-label={
                                      isBillingUS
                                        ? "Zip code (billing)"
                                        : "Postal code (billing)"
                                    }
                                    className={checkoutFieldHeight}
                                    placeholder={
                                      isBillingUS ? "Zip code" : "Postal code"
                                    }
                                    value={billingForm.zip}
                                    onChange={(e) =>
                                      updateBilling("zip", e.target.value)
                                    }
                                  />
                                </div>
                              </div>
                              <div className="sm:col-span-2">
                                <Input
                                  aria-label="Phone (optional)"
                                  className={checkoutFieldHeight}
                                  placeholder="Phone (optional)"
                                  type="tel"
                                  value={billingForm.phone}
                                  onChange={(e) =>
                                    updateBilling("phone", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Crypto — hidden when no crypto methods enabled via admin */}
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
                                setPaymentSubOption(opt.value);
                                setValidationErrors([]);
                                if (opt.value !== "other")
                                  setCryptoOtherSubOption("");
                              }}
                              className="size-4 border-input text-primary focus:ring-primary"
                            />
                            <span className="text-sm">{opt.label}</span>
                            {CRYPTO_LOGO_SRC[opt.value] ? (
                              <Image
                                alt={opt.label}
                                className="ml-auto h-7 w-9 shrink-0 object-contain"
                                height={28}
                                src={CRYPTO_LOGO_SRC[opt.value]!}
                                width={36}
                              />
                            ) : null}
                          </label>
                          {opt.value === "eth" &&
                            paymentSubOption === "eth" && (
                              <div className="ml-5 mt-2 space-y-2 border-l-2 border-muted pl-4">
                                {ETH_CHAIN_OPTIONS.map((chainOpt) => (
                                  <label
                                    key={chainOpt.value}
                                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20"
                                  >
                                    <input
                                      type="radio"
                                      name="payment-crypto-eth-chain"
                                      checked={
                                        cryptoEthChain === chainOpt.value
                                      }
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
                                    {CRYPTO_LOGO_SRC[otherOpt.value] ? (
                                      <Image
                                        alt={otherOpt.label}
                                        className="ml-auto h-7 w-9 shrink-0 object-contain"
                                        height={28}
                                        src={CRYPTO_LOGO_SRC[otherOpt.value]!}
                                        width={36}
                                      />
                                    ) : null}
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

                {/* Stablecoins (USDC, USDT) — hidden when both disabled via admin */}
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
                      <span className="text-sm font-medium">Stablecoins</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Image
                        alt="USDC"
                        className="h-7 w-9 shrink-0 object-contain"
                        height={28}
                        src="/crypto/usdc/usdc-logo.svg"
                        width={36}
                      />
                      <Image
                        alt="USDT"
                        className="h-7 w-9 shrink-0 object-contain"
                        height={28}
                        src="/crypto/usdt/tether-usdt-logo.svg"
                        width={36}
                      />
                    </div>
                  </label>
                  {paymentMethod === "stablecoins" && (
                    <div className="space-y-2 border-t border-border px-3 pb-3 pt-4">
                      <div className="mb-2 flex gap-2">
                        {(visibility === null || visibility.stablecoinUsdc) && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20">
                          <input
                            type="radio"
                            name="payment-stablecoin-token"
                            checked={stablecoinToken === "usdc"}
                            onChange={() => {
                              setStablecoinToken("usdc");
                              setPaymentSubOption("solana" as UsdcSub);
                              setValidationErrors([]);
                            }}
                            className="size-4 border-input text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">USDC</span>
                          <Image
                            alt="USDC"
                            className="size-5 shrink-0 object-contain"
                            height={20}
                            src="/crypto/usdc/usdc-logo.svg"
                            width={20}
                          />
                        </label>
                        )}
                        {(visibility === null || visibility.stablecoinUsdt) && (
                        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20">
                          <input
                            type="radio"
                            name="payment-stablecoin-token"
                            checked={stablecoinToken === "usdt"}
                            onChange={() => {
                              setStablecoinToken("usdt");
                              setPaymentSubOption("ethereum" as UsdtSub);
                              setValidationErrors([]);
                            }}
                            className="size-4 border-input text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">USDT</span>
                          <Image
                            alt="USDT"
                            className="size-5 shrink-0 object-contain"
                            height={20}
                            src="/crypto/usdt/tether-usdt-logo.svg"
                            width={20}
                          />
                        </label>
                        )}
                      </div>
                      {stablecoinToken === "usdc"
                        ? visibleUsdcSubOptions.map((opt) => (
                            <label
                              key={opt.value}
                              className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20"
                            >
                              <input
                                type="radio"
                                name="payment-usdc"
                                checked={paymentSubOption === opt.value}
                                onChange={() => {
                                  setPaymentSubOption(opt.value);
                                  setValidationErrors([]);
                                }}
                                className="size-4 border-input text-primary focus:ring-primary"
                              />
                              <span className="text-sm">{opt.label}</span>
                              {USDC_LOGO_SRC[opt.value] ? (
                                <Image
                                  alt={opt.label}
                                  className="ml-auto h-7 w-9 shrink-0 object-contain"
                                  height={28}
                                  src={USDC_LOGO_SRC[opt.value]!}
                                  width={36}
                                />
                              ) : null}
                            </label>
                          ))
                        : USDT_SUB_OPTIONS.map((opt) => (
                            <label
                              key={opt.value}
                              className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-2.5 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary/20"
                            >
                              <input
                                type="radio"
                                name="payment-usdt"
                                checked={paymentSubOption === opt.value}
                                onChange={() => {
                                  setPaymentSubOption(opt.value);
                                  setValidationErrors([]);
                                }}
                                className="size-4 border-input text-primary focus:ring-primary"
                              />
                              <span className="text-sm">{opt.label}</span>
                              {USDT_LOGO_SRC[opt.value] ? (
                                <Image
                                  alt={opt.label}
                                  className="ml-auto h-7 w-9 shrink-0 object-contain"
                                  height={28}
                                  src={USDT_LOGO_SRC[opt.value]!}
                                  width={36}
                                />
                              ) : null}
                            </label>
                          ))}
                    </div>
                  )}
                </div>
                )}

                {/* PayPal — hidden when hiddenOptions.paypal */}
                {!hiddenOptions.paypal && (
                  <div className="space-y-0">
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
                    {paymentMethod === "paypal" && (
                      <div className="border-t border-border px-3 pb-3 pt-4">
                        <p className="text-sm text-muted-foreground">
                          Coming soon.
                        </p>
                      </div>
                    )}
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
                      : paymentMethod === "stablecoins" && stablecoinToken === "usdc"
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
                      : paymentMethod === "stablecoins" && stablecoinToken === "usdc" &&
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
                  This payment option is not available yet. Use Credit/debit
                  card, Crypto, Stablecoins (USDC/USDT), or PayPal.
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
          </div>

          {/* Right: Your order only — sticky offset below header (max-h-24) so header doesn't overlap */}
          <div className="min-w-0 space-y-6 sm:col-start-2 sm:sticky sm:top-28 sm:self-start">
            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Your order</CardTitle>
                <CardDescription>
                  {itemCount} item{itemCount !== 1 ? "s" : ""} in your cart
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => (
                  <div
                    className="flex gap-4 rounded-lg border border-border/60 bg-muted/30 p-3"
                    key={item.id}
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md">
                      <Image
                        alt={item.name}
                        className="object-cover"
                        fill
                        sizes="64px"
                        src={item.image}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × <FiatPrice usdAmount={item.price} />
                      </p>
                    </div>
                    <p className="font-medium">
                      <FiatPrice usdAmount={item.price * item.quantity} />
                    </p>
                  </div>
                ))}
                <div className="space-y-2 border-t border-border pt-3 text-sm">
                  <div className="space-y-2">
                    {!showDiscountCode ? (
                      <button
                        type="button"
                        onClick={() => setShowDiscountCode(true)}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Have a code?
                      </button>
                    ) : (
                      <div className="flex w-full max-w-[65%] flex-col gap-2">
                        <div className="flex gap-2">
                          <Input
                            type="text"
                            placeholder="Discount code or gift card"
                            value={discountCodeInput}
                            onChange={(e) => {
                              setDiscountCodeInput(e.target.value);
                              setCouponError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyCoupon();
                              }
                            }}
                            className={cn(checkoutFieldHeight, "min-w-0 flex-1")}
                            disabled={couponLoading}
                            aria-label="Discount code"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className={cn(checkoutFieldHeight, "shrink-0")}
                            onClick={handleApplyCoupon}
                            disabled={
                              couponLoading || !discountCodeInput.trim()
                            }
                          >
                            {couponLoading ? (
                              <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                              "Apply"
                            )}
                          </Button>
                        </div>
                        {couponError ? (
                          <p className="text-xs text-destructive">{couponError}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      <FiatPrice usdAmount={subtotal} />
                    </span>
                  </div>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="flex items-center gap-2 font-medium">
                        {appliedCoupon.freeShipping ? (
                          "Free shipping"
                        ) : (
                          <FiatPrice
                            usdAmount={appliedCoupon.discountCents / 100}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponError("");
                          }}
                          className="text-xs text-primary underline-offset-4 hover:underline"
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      Shipping
                      {shippingLabel ? (
                        <span className="text-xs font-normal normal-case text-muted-foreground/80">
                          ({shippingLabel})
                        </span>
                      ) : null}
                      <Dialog>
                        <DialogTrigger
                          type="button"
                          className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label="Shipping information"
                        >
                          <CircleHelp className="size-4" aria-hidden />
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Shipping</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-foreground">
                            {SHIPPING_POLICY_CONTENT}
                          </p>
                        </DialogContent>
                      </Dialog>
                    </span>
                    <span className="font-medium">
                      {shippingLoading ? (
                        "…"
                      ) : shippingFree ? (
                        "Free"
                      ) : (
                        <FiatPrice usdAmount={shippingCents / 100} />
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">
                      <FiatPrice usdAmount={0} />
                    </span>
                  </div>
                </div>
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                  <span>Total</span>
                  <span>
                    <FiatPrice usdAmount={total} />
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Solana Pay: QR + open wallet, poll for confirmation */}
      <Dialog
        onOpenChange={(open) => !open && closeSolanaPayDialog()}
        open={solanaPayOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay with Solana</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan the QR code with your wallet or open the link below to pay
              with USDC.
            </p>
            <div
              ref={qrContainerRef}
              className="flex min-h-[256px] min-w-[256px] justify-center rounded-lg border border-border bg-white p-4"
              aria-hidden
            />
            {solanaPayUrl && (
              <Button asChild className="w-full" size="lg" variant="outline">
                <a href={solanaPayUrl.toString()}>Open in wallet</a>
              </Button>
            )}
            {solanaPayStatus === "pending" && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Waiting for payment…
              </p>
            )}
            {solanaPayStatus === "confirmed" && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Payment confirmed. Redirecting…
              </p>
            )}
            {solanaPayStatus === "error" && (
              <p className="text-sm text-destructive">
                Payment validation failed. Please try again.
              </p>
            )}
            {solanaPayStatus === "connection-error" && (
              <p className="text-sm text-destructive">
                Connection error. Please check your network and try again.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PolicyPopup({
  title,
  content,
  fullPolicyHref,
  children,
}: {
  title: string;
  content?: string;
  /** If set, shows a "Read full policy" link that opens in a new tab. */
  fullPolicyHref?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-primary hover:underline" type="button">
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {content ? (
            <p className="text-sm text-foreground whitespace-pre-line">
              {content}
            </p>
          ) : null}
          {fullPolicyHref ? (
            <p className="text-sm">
              <a
                href={fullPolicyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Read full policy
              </a>
              <span className="text-muted-foreground"> (opens in new tab)</span>
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
