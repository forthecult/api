import { relations } from "drizzle-orm";
import { sizeChartsTable } from "./tables";

export const sizeChartsRelations = relations(sizeChartsTable, () => ({}));
