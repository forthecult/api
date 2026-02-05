/**
 * Next.js middleware: must be default export from middleware.ts.
 * Delegates to proxy (CORS for admin/auth/user APIs, rate limit, cookies).
 */
import { proxy, config } from "~/proxy";

export default proxy;
export { config };
