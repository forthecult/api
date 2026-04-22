/**
 * Shared builders for schema.org `MerchantReturnPolicy` + `OfferShippingDetails`
 * that are referenced by every Product JSON-LD so Google Merchant Listings don't
 * report "Missing field hasMerchantReturnPolicy" / "Missing field shippingDetails".
 *
 * The policy is defined in code (mirroring the public `/policies/refund` and
 * `/policies/shipping` pages) so it applies to every SKU by default. Product
 * or category overrides can be layered on top later via DB columns without
 * changing crawl behaviour.
 *
 * Schema.org refs:
 *  - https://schema.org/MerchantReturnPolicy
 *  - https://schema.org/OfferShippingDetails
 *  - https://developers.google.com/search/docs/appearance/structured-data/product
 */

interface ShippingRateOpts {
  /** Override the currency code used on the shipping rate. Defaults to the offer currency. */
  currency?: string;
  /** Default flat shipping fee (in major units, e.g. dollars) used for the fallback country. */
  flatShippingFee?: number;
}

interface ShippingDetailsOpts {
  /** Destination country codes (ISO 3166-1 alpha-2). Empty/undefined → worldwide fallback. */
  availableCountryCodes?: string[];
  /** Currency code (e.g. "USD") for shipping rates. */
  currency: string;
  /** Handling (prep) days range from the merchant/vendor. */
  handlingDaysMax?: null | number;
  handlingDaysMin?: null | number;
  /** Transit days range. */
  transitDaysMax?: null | number;
  transitDaysMin?: null | number;
}

/** Default flat shipping fee used when no per-country rate is known. Keep conservative; real rates come from `/api/cart/estimate`. */
const FALLBACK_FLAT_SHIPPING_FEE = 0;

/**
 * Returns a `MerchantReturnPolicy` graph node aligned with
 * {@link https://www.forthecult.store/policies/refund the public refund policy}.
 */
export function buildDefaultMerchantReturnPolicy(siteUrl: string) {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: ["US", "CA", "GB", "EU", "AU", "DE", "FR", "NL", "ES"],
    merchantReturnDays: 30,
    merchantReturnLink: `${siteUrl}/policies/refund`,
    refundType: "https://schema.org/FullRefund",
    returnFees: "https://schema.org/FreeReturn",
    returnMethod: "https://schema.org/ReturnByMail",
    returnPolicyCategory:
      "https://schema.org/MerchantReturnFiniteReturnWindow",
  };
}

/**
 * Returns an `OfferShippingDetails` graph node. When concrete handling/transit
 * days are known we emit them; otherwise the node still satisfies Google's
 * "Missing field shippingDetails" warning with a reasonable estimate.
 */
export function buildDefaultOfferShippingDetails(
  siteUrl: string,
  opts: ShippingDetailsOpts,
  rate: ShippingRateOpts = {},
) {
  const {
    availableCountryCodes,
    currency,
    handlingDaysMax,
    handlingDaysMin,
    transitDaysMax,
    transitDaysMin,
  } = opts;
  const flat = rate.flatShippingFee ?? FALLBACK_FLAT_SHIPPING_FEE;

  const destinationCountries =
    availableCountryCodes && availableCountryCodes.length > 0
      ? availableCountryCodes
      : ["US", "CA", "GB", "EU", "AU"];

  return {
    "@type": "OfferShippingDetails",
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        maxValue: handlingDaysMax ?? 3,
        minValue: handlingDaysMin ?? 0,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        maxValue: transitDaysMax ?? 14,
        minValue: transitDaysMin ?? 2,
        unitCode: "DAY",
      },
    },
    shippingDestination: destinationCountries.map((country) => ({
      "@type": "DefinedRegion",
      addressCountry: country,
    })),
    shippingOrigin: {
      "@type": "DefinedRegion",
      addressCountry: "US",
    },
    shippingPolicy: `${siteUrl}/policies/shipping`,
    shippingRate: {
      "@type": "MonetaryAmount",
      currency: rate.currency ?? currency,
      value: flat,
    },
  };
}

/** Google Merchant item condition mapped to schema.org URL form. */
export function itemConditionUrl(
  condition: null | string | undefined,
): string {
  switch ((condition ?? "new").toLowerCase()) {
    case "damaged": {
      return "https://schema.org/DamagedCondition";
    }
    case "refurbished": {
      return "https://schema.org/RefurbishedCondition";
    }
    case "used": {
      return "https://schema.org/UsedCondition";
    }
    default: {
      return "https://schema.org/NewCondition";
    }
  }
}
