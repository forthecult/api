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
  id: number;
  name: string;
  tagline: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  icon: ElementType;
  benefits: {
    esim: string;
    esimDetail: string;
    shipping: string;
    shippingDetail: string;
    extras: string[];
  };
  popular?: boolean;
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: 4,
    name: "Tier 4",
    tagline: "Start your journey",
    accent: "text-muted-foreground",
    accentBg: "bg-muted/60",
    accentBorder: "border-border",
    icon: Signal,
    benefits: {
      esim: "10% off",
      esimDetail: "10% discount on all eSIM data plans",
      shipping: "Standard rates",
      shippingDetail: "Standard shipping rates apply",
      extras: ["Community access", "Governance voting"],
    },
  },
  {
    id: 3,
    name: "Tier 3",
    tagline: "Level up your membership",
    accent: "text-chart-2",
    accentBg: "bg-chart-2/10",
    accentBorder: "border-chart-2/30",
    icon: Shield,
    benefits: {
      esim: "15% off",
      esimDetail: "15% discount on all eSIM data plans",
      shipping: "20% off",
      shippingDetail: "20% off all shipping costs",
      extras: [
        "Community access",
        "Governance voting",
        "Early product access",
      ],
    },
  },
  {
    id: 2,
    name: "Tier 2",
    tagline: "Unlock serious value",
    accent: "text-chart-4",
    accentBg: "bg-chart-4/10",
    accentBorder: "border-chart-4/30",
    icon: Star,
    popular: true,
    benefits: {
      esim: "Free eSIM",
      esimDetail: "One free eSIM card included with your membership",
      shipping: "50% off",
      shippingDetail: "50% off all shipping costs",
      extras: [
        "Community access",
        "Governance voting",
        "Early product access",
        "Member-only drops",
      ],
    },
  },
  {
    id: 1,
    name: "Tier 1",
    tagline: "The ultimate membership",
    accent: "text-chart-1",
    accentBg: "bg-chart-1/10",
    accentBorder: "border-chart-1/30",
    icon: Crown,
    benefits: {
      esim: "Premium eSIM",
      esimDetail:
        "Premium free eSIM card with higher data allowance included",
      shipping: "Free",
      shippingDetail: "Free shipping on every order, worldwide",
      extras: [
        "Community access",
        "Governance voting",
        "Early product access",
        "Member-only drops",
        "Priority support",
        "Exclusive product access",
        "Daily SOL creator fee distribution",
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// Benefits comparison rows for table
// ---------------------------------------------------------------------------

export interface MembershipBenefitRow {
  label: string;
  icon: ElementType;
  values: Record<number, string | boolean>;
}

export const MEMBERSHIP_BENEFIT_ROWS: MembershipBenefitRow[] = [
  {
    label: "eSIM Discount",
    icon: Smartphone,
    values: { 4: "10% off", 3: "15% off", 2: "Free eSIM", 1: "Premium eSIM" },
  },
  {
    label: "Shipping",
    icon: Truck,
    values: {
      4: "Standard",
      3: "20% off",
      2: "50% off",
      1: "Free",
    },
  },
  {
    label: "Community Access",
    icon: Users,
    values: { 4: true, 3: true, 2: true, 1: true },
  },
  {
    label: "Voting",
    icon: Shield,
    values: { 4: true, 3: true, 2: true, 1: true },
  },
  {
    label: "Early Product Access",
    icon: Zap,
    values: { 4: false, 3: true, 2: true, 1: true },
  },
  {
    label: "Member-Only Drops",
    icon: Sparkles,
    values: { 4: false, 3: false, 2: true, 1: true },
  },
  {
    label: "Exclusive Products",
    icon: Crown,
    values: { 4: false, 3: false, 2: false, 1: true },
  },
  {
    label: "Creator Fee Distribution",
    icon: Coins,
    values: { 4: false, 3: false, 2: false, 1: true },
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const MEMBERSHIP_FAQ = [
  {
    q: "How does staking work?",
    a: "When you stake tokens, they are locked in a smart contract on Solana for your chosen duration (30 days or 12 months). Your membership tier is active for the entire staking period. When the period ends, you can unstake to retrieve your tokens or re-stake to maintain your membership.",
  },
  {
    q: "Why are staking requirements dynamic?",
    a: "The required stake amount adjusts based on the token's market cap and the number of existing stakers—similar to a bonding curve. This ensures membership remains accessible as the price fluctuates and rewards early adopters.",
  },
  {
    q: "What happens when my staking period ends?",
    a: "Your membership benefits remain active until the end of the staking period. You'll receive a notification before it expires so you can choose to re-stake. Your tokens are returned to your wallet when you unstake.",
  },
  {
    q: "Can I upgrade my tier?",
    a: "Yes. You can stake additional tokens to move up to a higher tier at any time. The additional tokens will be locked for the same duration as your original stake.",
  },
  {
    q: "What eSIM card do I get?",
    a: "Tier 2 members receive a standard eSIM card. Tier 1 members receive a premium eSIM card with higher data allowances. Both are activated instantly and work in 200+ countries.",
  },
  {
    q: "Why stake for 12 months?",
    a: "Staking for 12 months gives you 14 months of eSIM coverage—that's 2 extra months free. It also demonstrates long-term commitment to the community, which strengthens the ecosystem for everyone.",
  },
];
