import { NextResponse } from "next/server";

/**
 * Deploy verification: GET /api/build-info
 * If this returns 200 with app: "ftc-admin", the admin app is deployed.
 * If you get 404 here, the Root Directory is wrong (e.g. use ftc/admin not admin).
 */
export function GET() {
  return NextResponse.json({
    app: "ftc-admin",
    hasPaymentMethodsRoute: true,
  });
}
