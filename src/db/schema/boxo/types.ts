import type { InferSelectModel } from "drizzle-orm";

import type {
  boxoAuthCodeTable,
  boxoOrderPaymentTable,
  boxoTokenTable,
} from "./tables";

export type BoxoAuthCode = InferSelectModel<typeof boxoAuthCodeTable>;
export type BoxoToken = InferSelectModel<typeof boxoTokenTable>;
export type BoxoOrderPayment = InferSelectModel<typeof boxoOrderPaymentTable>;
