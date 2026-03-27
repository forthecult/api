import type { ElementType } from "react";

import {
  Crown,
  Lock,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Users,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tier definitions (display order: BASE → APEX; id 3 = BASE, 2 = PRIME, 1 = APEX)
// ---------------------------------------------------------------------------

export interface MembershipTier {
  accent: string;
  accentBg: string;
  accentBorder: string;
  benefits: {
    esim: string;
    esimDetail: string;
    extras: string[];
    shipping: string;
    shippingDetail: string;
  };
  icon: ElementType;
  id: number;
  name: string;
  popular?: boolean;
  tagline: string;
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    accent: "text-chart-2",
    accentBg: "bg-chart-2/10",
    accentBorder: "border-chart-2/30",
    benefits: {
      esim: "15% off",
      esimDetail: "15% discount on all eSIM data plans",
      extras: ["Community access", "Governance voting", "Early product access"],
      shipping: "25% off",
      shippingDetail: "25% off all shipping costs",
    },
    icon: Shield,
    id: 3,
    name: "BASE",
    tagline: "Level up your membership",
  },
  {
    accent: "text-chart-4",
    accentBg: "bg-chart-4/10",
    accentBorder: "border-chart-4/30",
    benefits: {
      esim: "25% off",
      esimDetail: "25% discount on all eSIM data plans",
      extras: [
        "Community access",
        "Governance voting",
        "Member-only drops",
        "Exclusive product access",
      ],
      shipping: "50% off",
      shippingDetail: "50% off all shipping costs",
    },
    icon: Star,
    id: 2,
    name: "PRIME",
    popular: true,
    tagline: "Unlock serious value",
  },
  {
    accent: "text-chart-1",
    accentBg: "bg-chart-1/10",
    accentBorder: "border-chart-1/30",
    benefits: {
      esim: "First eSIM free",
      esimDetail: "First eSIM free, 30% off additional eSIMs",
      extras: [
        "Community access",
        "Governance voting",
        "Member-only drops",
        "Priority support",
        "Exclusive product access",
        "Monthly VPN subscription",
      ],
      shipping: "Free",
      shippingDetail: "Free shipping on every order, worldwide",
    },
    icon: Crown,
    id: 1,
    name: "APEX",
    tagline: "The ultimate membership",
  },
];

// ---------------------------------------------------------------------------
// Benefits comparison rows for table
// ---------------------------------------------------------------------------

export interface MembershipBenefitRow {
  icon: ElementType;
  label: string;
  values: Record<number, boolean | string>;
}

export const MEMBERSHIP_BENEFIT_ROWS: MembershipBenefitRow[] = [
  {
    icon: Smartphone,
    label: "eSIM Discount",
    values: { 1: "1st free, 30% off more", 2: "25% off", 3: "15% off" },
  },
  {
    icon: Truck,
    label: "Shipping",
    values: {
      1: "Free",
      2: "50% off",
      3: "25% off",
    },
  },
  {
    icon: Users,
    label: "Community Access",
    values: { 1: true, 2: true, 3: true },
  },
  {
    icon: Shield,
    label: "Voting",
    values: { 1: true, 2: true, 3: true },
  },
  {
    icon: Zap,
    label: "Early Product Access",
    values: { 1: false, 2: false, 3: true },
  },
  {
    icon: Sparkles,
    label: "Member-Only Drops",
    values: { 1: true, 2: true, 3: false },
  },
  {
    icon: Crown,
    label: "Exclusive Products",
    values: { 1: true, 2: true, 3: false },
  },
  {
    icon: Lock,
    label: "Monthly VPN Subscription",
    values: { 1: true, 2: false, 3: false },
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const MEMBERSHIP_FAQ = [
  {
    a: "When you stake tokens, they are locked in a smart contract on Solana for your chosen duration (30 days or 12 months). Your membership tier is active for the entire staking period. When the period ends, you can unstake to retrieve your tokens or re-stake to maintain your membership.",
    q: "How does staking work?",
  },
  {
    a: "The required stake amount adjusts based on the token's market cap and the number of existing stakers—similar to a bonding curve. This ensures membership remains accessible as the price fluctuates and rewards early adopters.",
    q: "Why are staking requirements dynamic?",
  },
  {
    a: "Your membership benefits remain active until the end of the staking period. You'll receive a notification before it expires so you can choose to re-stake. Your tokens are returned to your wallet when you unstake.",
    q: "What happens when my staking period ends?",
  },
  {
    a: "Yes. You can stake additional tokens to move up to a higher tier at any time. The additional tokens will be locked for the same duration as your original stake.",
    q: "Can I upgrade my tier?",
  },
  {
    a: "APEX members get the first eSIM free and 30% off additional eSIMs, plus free shipping. PRIME gets 25% off eSIMs and shipping; BASE gets 15% off eSIMs and shipping. eSIMs are activated instantly and work in 200+ countries.",
    q: "What eSIM card do I get?",
  },
  {
    a: "Staking for 12 months gives you eSIM benefits for 14 months—that's 2 extra months free. It also demonstrates long-term commitment to the community, which strengthens the ecosystem for everyone.",
    q: "Why stake for 12 months?",
  },
  {
    a: "Yes! If you prefer not to use crypto, you can subscribe with a credit card for $5/$10/$20 per month (BASE/PRIME/APEX). Annual subscriptions save 10%. You get the same tier benefits as staking.",
    q: "Can I pay with a credit card instead of staking?",
  },
  {
    a: "Absolutely. You can cancel your subscription anytime from the billing portal. Your membership stays active until the end of your current billing period.",
    q: "Can I cancel my subscription?",
  },
  {
    a: "Both give you the same membership benefits. Staking locks your CULT tokens (you keep ownership) and can be more cost-effective long-term. Subscribing with a card is simpler—no wallet needed—but is a recurring monthly or annual charge.",
    q: "What's the difference between staking and subscribing?",
  },
];

// ---------------------------------------------------------------------------
// Subscription pricing (monthly fee alternative to staking)
// ---------------------------------------------------------------------------

/** Annual discount rate applied on top of the monthly price × 12. */
export const SUBSCRIPTION_ANNUAL_DISCOUNT = 0.1;

export interface SubscriptionPrice {
  /** Stripe Price ID for annual billing. Falls back to dynamic creation if env var absent. */
  annualPriceId: string | undefined;
  /** Annual cost in USD (monthly * 12 * (1 - discount)). */
  annualUsd: number;
  /** Monthly cost in USD. */
  monthlyUsd: number;
  /** Stripe Price ID for monthly billing. Falls back to dynamic creation if env var absent. */
  monthlyPriceId: string | undefined;
  /** PayPal billing plan id (`P-...`) for annual billing. */
  paypalAnnualPlanId: string | undefined;
  /** PayPal billing plan id for monthly billing. */
  paypalMonthlyPlanId: string | undefined;
  tierId: number;
  tierName: string;
}

export const SUBSCRIPTION_PRICES: SubscriptionPrice[] = [
  {
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASE_ANNUAL,
    annualUsd: parseFloat(
      (5 * 12 * (1 - SUBSCRIPTION_ANNUAL_DISCOUNT)).toFixed(2),
    ),
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASE_MONTHLY,
    monthlyUsd: 5,
    paypalAnnualPlanId: process.env.PAYPAL_PLAN_BASE_ANNUAL,
    paypalMonthlyPlanId: process.env.PAYPAL_PLAN_BASE_MONTHLY,
    tierId: 3,
    tierName: "BASE",
  },
  {
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRIME_ANNUAL,
    annualUsd: parseFloat(
      (10 * 12 * (1 - SUBSCRIPTION_ANNUAL_DISCOUNT)).toFixed(2),
    ),
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRIME_MONTHLY,
    monthlyUsd: 10,
    paypalAnnualPlanId: process.env.PAYPAL_PLAN_PRIME_ANNUAL,
    paypalMonthlyPlanId: process.env.PAYPAL_PLAN_PRIME_MONTHLY,
    tierId: 2,
    tierName: "PRIME",
  },
  {
    annualPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_APEX_ANNUAL,
    annualUsd: parseFloat(
      (20 * 12 * (1 - SUBSCRIPTION_ANNUAL_DISCOUNT)).toFixed(2),
    ),
    monthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_APEX_MONTHLY,
    monthlyUsd: 20,
    paypalAnnualPlanId: process.env.PAYPAL_PLAN_APEX_ANNUAL,
    paypalMonthlyPlanId: process.env.PAYPAL_PLAN_APEX_MONTHLY,
    tierId: 1,
    tierName: "APEX",
  },
];
