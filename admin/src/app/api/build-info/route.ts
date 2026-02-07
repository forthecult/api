import { NextResponse } from "next/server";

/**
 * Deploy verification: GET /api/build-info
 * If this returns 200 with app: "relivator-admin", the admin app is deployed.
 * If you get 404 here, the Root Directory is wrong (e.g. use relivator/admin not admin).
 */
export function GET() {
  return NextResponse.json({
    app: "relivator-admin",
    hasPaymentMethodsRoute: true,
  });
}
