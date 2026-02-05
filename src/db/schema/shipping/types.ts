import type { InferSelectModel } from "drizzle-orm";

import type { shippingOptionsTable } from "./tables";

export type ShippingOption = InferSelectModel<typeof shippingOptionsTable>;
