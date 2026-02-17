/**
 * GET /api/esim/packages/staker-claim
 *
 * Returns 30-day eSIM packages under $25 (after markup) for staker claim.
 * Intended for members who have staked: they may claim one of these without payment.
 * Response omits price (do not display to user).
 */

import {
  checkPackageAvailability,
  getEsimGlobalPackages,
} from "~/lib/esim-api";

const MAX_PRICE_USD = 25;
const VALIDITY_DAYS = 30;

export async function GET() {
  try {
    const markup = Number(process.env.ESIM_MARKUP_PERCENT) || 30;
    const result = await getEsimGlobalPackages("DATA-ONLY");

    const enriched = await Promise.all(
      result.data.map(async (pkg) => {
        const { available, has5g } = await checkPackageAvailability(pkg.id);
        const priceUsd = Number(pkg.price) * (1 + markup / 100);
        const is30Day =
          (pkg.package_validity_unit ?? "day").toLowerCase() === "day" &&
          (pkg.package_validity ?? 0) === VALIDITY_DAYS;
        return {
          available,
          has5g,
          pkg,
          priceUsd,
          qualifies: available && is30Day && priceUsd < MAX_PRICE_USD,
        };
      }),
    );

    const data = enriched
      .filter((e) => e.qualifies)
      .map(({ has5g, pkg }) => ({
        data_quantity: pkg.data_quantity,
        data_unit: pkg.data_unit,
        has5g,
        id: pkg.id,
        name: pkg.name,
        package_type: pkg.package_type,
        package_validity: pkg.package_validity,
        package_validity_unit: pkg.package_validity_unit,
      }));

    return Response.json({ data, status: true });
  } catch (error) {
    console.error("eSIM staker-claim packages error:", error);
    return Response.json(
      { message: "Failed to fetch staker eSIM packages", status: false },
      { status: 500 },
    );
  }
}
