/**
 * Type declaration for x402-next when the package or its types are not installed.
 * Install with: bun add x402-next
 */
declare module "x402-next" {
  import type { NextRequest } from "next/server";

  type RouteConfig = {
    price: string;
    network: string;
    config?: { description?: string; maxTimeoutSeconds?: number };
  };

  export function withX402(
    handler: (request: NextRequest) => Promise<Response>,
    payTo: `0x${string}` | string,
    routeConfig: RouteConfig,
    facilitator?: { url: string },
  ): (request: NextRequest) => Promise<Response>;
}
