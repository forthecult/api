import type { InferSelectModel } from "drizzle-orm";

import type { stripeCustomerTable } from "./tables";

export type StripeCustomer = InferSelectModel<typeof stripeCustomerTable>;
