import type { InferSelectModel } from "drizzle-orm";

import type { sizeChartsTable } from "./tables";

export type SizeChart = InferSelectModel<typeof sizeChartsTable>;

export interface SizeChartData {
  availableSizes?: string[];
  sizeTables?: SizeChartTable[];
}

export interface SizeChartMeasurement {
  type_label: string;
  values: SizeChartMeasurementValue[];
}

/** Stored size table measurement row (size label + value or min/max). */
export type SizeChartMeasurementValue =
  | { max_value: string; min_value: string; size: string }
  | { size: string; value: string };

export interface SizeChartTable {
  description?: string;
  image_url?: string;
  measurements?: SizeChartMeasurement[];
  type: string;
  unit: string;
}
