import type { ElementType } from "react";

import {
  Coins,
  Crown,
  Shield,
  Signal,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Users,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Tier definitions (display order: Tier 4 → Tier 1)
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
    accent: "text-muted-foreground",
    accentBg: "bg-muted/60",
    accentBorder: "border-border",
    benefits: {
      esim: "10% off",
      esimDetail: "10% discount on all eSIM data plans",
      extras: ["Community access", "Governance voting"],
      shipping: "Standard rates",
      shippingDetail: "Standard shipping rates apply",
    },
    icon: Signal,
    id: 4,
    name: "Tier 4",
    tagline: "Start your journey",
  },
  {
    accent: "text-chart-2",
    accentBg: "bg-chart-2/10",
    accentBorder: "border-chart-2/30",
    benefits: {
      esim: "15% off",
      esimDetail: "15% discount on all eSIM data plans",
      extras: ["Community access", "Governance voting", "Early product access"],
      shipping: "20% off",
      shippingDetail: "20% off all shipping costs",
    },
    icon: Shield,
    id: 3,
    name: "Tier 3",
    tagline: "Level up your membership",
  },
  {
    accent: "text-chart-4",
    accentBg: "bg-chart-4/10",
    accentBorder: "border-chart-4/30",
    benefits: {
      esim: "Free eSIM",
      esimDetail: "One free eSIM card included with your membership",
      extras: [
        "Community access",
        "Governance voting",
        "Early product access",
        "Member-only drops",
      ],
      shipping: "50% off",
      shippingDetail: "50% off all shipping costs",
    },
    icon: Star,
    id: 2,
    name: "Tier 2",
    popular: true,
    tagline: "Unlock serious value",
  },
  {
    accent: "text-chart-1",
    accentBg: "bg-chart-1/10",
    accentBorder: "border-chart-1/30",
    benefits: {
      esim: "Premium eSIM",
      esimDetail: "Premium free eSIM card with higher data allowance included",
      extras: [
        "Community access",
        "Governance voting",
        "Early product access",
        "Member-only drops",
        "Priority support",
        "Exclusive product access",
        "Daily SOL creator fee distribution",
      ],
      shipping: "Free",
      shippingDetail: "Free shipping on every order, worldwide",
    },
    icon: Crown,
    id: 1,
    name: "Tier 1",
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
    values: { 1: "Premium eSIM", 2: "Free eSIM", 3: "15% off", 4: "10% off" },
  },
  {
    icon: Truck,
    label: "Shipping",
    values: {
      1: "Free",
      2: "50% off",
      3: "20% off",
      4: "Standard",
    },
  },
  {
    icon: Users,
    label: "Community Access",
    values: { 1: true, 2: true, 3: true, 4: true },
  },
  {
    icon: Shield,
    label: "Voting",
    values: { 1: true, 2: true, 3: true, 4: true },
  },
  {
    icon: Zap,
    label: "Early Product Access",
    values: { 1: true, 2: true, 3: true, 4: false },
  },
  {
    icon: Sparkles,
    label: "Member-Only Drops",
    values: { 1: true, 2: true, 3: false, 4: false },
  },
  {
    icon: Crown,
    label: "Exclusive Products",
    values: { 1: true, 2: false, 3: false, 4: false },
  },
  {
    icon: Coins,
    label: "Creator Fee Distribution",
    values: { 1: true, 2: false, 3: false, 4: false },
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
    a: "Tier 2 members receive a standard eSIM card. Tier 1 members receive a premium eSIM card with higher data allowances. Both are activated instantly and work in 200+ countries.",
    q: "What eSIM card do I get?",
  },
  {
    a: "Staking for 12 months gives you 14 months of eSIM coverage—that's 2 extra months free. It also demonstrates long-term commitment to the community, which strengthens the ecosystem for everyone.",
    q: "Why stake for 12 months?",
  },
];
