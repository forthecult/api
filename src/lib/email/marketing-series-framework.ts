import type { EmailFunnelId } from "~/lib/email/funnel-enrollment";

interface MarketingSeriesPlanInput {
  baseUrl: string;
  contentVariant: string;
  funnel: EmailFunnelId;
  hasCoupon: boolean;
  orderId?: string;
  step: 1 | 2 | 3;
}

export interface MarketingSeriesEmailPlan {
  bodyLines: readonly string[];
  campaignId: string;
  headline: string;
  picksSubtitle: string;
  preview: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  subject: string;
  utmCampaign: string;
  utmContent: string;
  videoLabel: string;
}

/**
 * Canonical lifecycle marketing copy + CTA framework.
 * Keeps funnel voice, UTM naming, and CTA positioning consistent across all steps.
 */
export function getMarketingSeriesEmailPlan(
  input: MarketingSeriesPlanInput,
): MarketingSeriesEmailPlan {
  const { baseUrl, contentVariant, funnel, hasCoupon, orderId, step } = input;

  if (funnel === "welcome_3") {
    if (step === 2) {
      const lineTwo =
        contentVariant === "web3_forward"
          ? "From James at For the Culture: card or crypto, same clean checkout."
          : "From James at For the Culture: new essentials drop weekly, no noise.";
      return {
        bodyLines: [
          "Glad you joined us. Here are strong first picks if you are just getting started.",
          lineTwo,
        ],
        campaignId: "welcome_series_2",
        headline: "A short starter list",
        picksSubtitle: "First-order favorites",
        preview: "Starter picks from Culture",
        primaryCtaHref: `${baseUrl}/shop`,
        primaryCtaLabel: "See top picks",
        subject: "Start here: best first picks",
        utmCampaign: "welcome_funnel",
        utmContent: "welcome_series_2",
        videoLabel: "Quick look: what people buy first",
      };
    }
    return {
      bodyLines: [
        "Small thank-you for being here. Membership unlocks early access and better pricing.",
        hasCoupon
          ? "Use the code below whenever you are ready."
          : "No rush - your account keeps improving recommendations over time.",
      ],
      campaignId: "welcome_series_3",
      headline: "Thanks for joining Culture",
      picksSubtitle: "Popular right now",
      preview: "A thank-you from James",
      primaryCtaHref: `${baseUrl}/membership`,
      primaryCtaLabel: "View membership",
      subject: hasCoupon
        ? "A thank-you + your extra perk"
        : "Thanks for being part of Culture",
      utmCampaign: "welcome_funnel",
      utmContent: "welcome_series_3",
      videoLabel: "What membership changes",
    };
  }

  if (funnel === "abandon_cart_3") {
    if (step === 1) {
      return {
        bodyLines: [
          "You left items in your cart. We saved everything for a quick finish.",
          "Most checkouts complete in under a minute.",
        ],
        campaignId: "abandon_cart_1",
        headline: "Your cart is still here",
        picksSubtitle: "From your cart and similar picks",
        preview: "Your cart is waiting",
        primaryCtaHref: `${baseUrl}/shop`,
        primaryCtaLabel: "Return to cart",
        subject: "You left something in your cart",
        utmCampaign: "abandon_cart_funnel",
        utmContent: "abandon_cart_1",
        videoLabel: "Quick cart return",
      };
    }
    if (step === 2) {
      return {
        bodyLines: [
          "If you are still deciding, inventory on smaller runs can move fast.",
          "Grab your size while it is available.",
        ],
        campaignId: "abandon_cart_2",
        headline: "Still considering it?",
        picksSubtitle: "Similar picks while stock lasts",
        preview: "Your cart is still saved",
        primaryCtaHref: `${baseUrl}/shop`,
        primaryCtaLabel: "Finish checkout",
        subject: "Still interested? Cart still open",
        utmCampaign: "abandon_cart_funnel",
        utmContent: "abandon_cart_2",
        videoLabel: "Fast checkout preview",
      };
    }
    return {
      bodyLines: [
        "Last note from us for this cart.",
        hasCoupon
          ? "If you check out soon, your extra code applies."
          : "If now is not the right time, no worries - your account stays ready.",
      ],
      campaignId: "abandon_cart_3",
      headline: "Final reminder for this cart",
      picksSubtitle: "Before this cart goes quiet",
      preview: "Final cart reminder",
      primaryCtaHref: `${baseUrl}/shop`,
      primaryCtaLabel: "Complete order",
      subject: hasCoupon
        ? "Last reminder + extra checkout perk"
        : "Last reminder before we close this cart",
      utmCampaign: "abandon_cart_funnel",
      utmContent: "abandon_cart_3",
      videoLabel: "One-click return to cart",
    };
  }

  if (funnel === "review_3") {
    const reviewHref = orderId
      ? `${baseUrl}/dashboard/orders/${orderId}`
      : `${baseUrl}/shop`;
    if (step === 1) {
      return {
        bodyLines: [
          "Your order should be with you now.",
          "A quick review helps the next buyer choose with confidence.",
        ],
        campaignId: "order_review_1",
        headline: "How did your order land?",
        picksSubtitle: "Customers who reviewed also liked",
        preview: "Quick review request",
        primaryCtaHref: reviewHref,
        primaryCtaLabel: orderId ? "Leave a review" : "View orders",
        subject: "How was your order?",
        utmCampaign: "review_funnel",
        utmContent: "order_review_1",
        videoLabel: "How to leave a 30-second review",
      };
    }
    if (step === 2) {
      return {
        bodyLines: [
          "Two minutes on fit, quality, or shipping helps other shoppers a lot.",
          "We read every review.",
        ],
        campaignId: "order_review_2",
        headline: "Quick favor from James",
        picksSubtitle: "Popular with recent reviewers",
        preview: "A quick review helps a lot",
        primaryCtaHref: reviewHref,
        primaryCtaLabel: "Write a quick review",
        subject: "Quick favor - leave a review?",
        utmCampaign: "review_funnel",
        utmContent: "order_review_2",
        videoLabel: "What great reviews include",
      };
    }
    return {
      bodyLines: [
        "Thanks for supporting independent builders and quality-first products.",
        hasCoupon
          ? "We added a small perk for your next order."
          : "Whenever you are ready, we would love to see you back.",
      ],
      campaignId: "order_review_3",
      headline: "Thanks again from Culture",
      picksSubtitle: "Because you already bought from us",
      preview: "Thanks for shopping with us",
      primaryCtaHref: `${baseUrl}/shop`,
      primaryCtaLabel: "Shop again",
      subject: hasCoupon ? "Thanks + a small perk" : "Thanks again from Culture",
      utmCampaign: "review_funnel",
      utmContent: "order_review_3",
      videoLabel: "What is new this week",
    };
  }

  // win_back_3
  if (step === 1) {
    return {
      bodyLines: [
        "It has been a while since your last order, so here is a clean update.",
        "New arrivals are in - curated, not crowded.",
      ],
      campaignId: "win_back_1",
      headline: "We saved you a short update",
      picksSubtitle: "New arrivals worth a look",
      preview: "What is new at Culture",
      primaryCtaHref: `${baseUrl}/products`,
      primaryCtaLabel: "Shop new arrivals",
      subject: "What is new at Culture",
      utmCampaign: "win_back_funnel",
      utmContent: "win_back_1",
      videoLabel: "New arrivals in 30 seconds",
    };
  }
  if (step === 2) {
    return {
      bodyLines: [
        "If this week is your return, membership makes repeat orders cheaper.",
        "You still get the same payment flexibility and fast checkout.",
      ],
      campaignId: "win_back_2",
      headline: "A quiet perk if you come back",
      picksSubtitle: "Member-friendly picks",
      preview: "Membership can lower your next order",
      primaryCtaHref: `${baseUrl}/membership`,
      primaryCtaLabel: "See membership options",
      subject: "Members are saving more on the same cart",
      utmCampaign: "win_back_funnel",
      utmContent: "win_back_2",
      videoLabel: "Membership in under one minute",
    };
  }
  return {
    bodyLines: [
      "Last note from us for now.",
      hasCoupon
        ? "If you want back in, your code is still below."
        : "If timing is not right, no pressure - we will still be here.",
    ],
    campaignId: "win_back_3",
    headline: "Last check-in",
    picksSubtitle: "Before this series closes",
    preview: "Last note for now",
    primaryCtaHref: `${baseUrl}/products`,
    primaryCtaLabel: "Browse the shop",
    subject: hasCoupon ? "One more reason to come back" : "Whenever you are ready",
    utmCampaign: "win_back_funnel",
    utmContent: "win_back_3",
    videoLabel: "Current catalog snapshot",
  };
}
