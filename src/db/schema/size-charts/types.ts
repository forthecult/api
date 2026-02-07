import type { InferSelectModel } from "drizzle-orm";
import type { sizeChartsTable } from "./tables";

export type SizeChart = InferSelectModel<typeof sizeChartsTable>;

/** Stored size table measurement row (size label + value or min/max). */
export type SizeChartMeasurementValue =
  | { size: string; value: string }
  | { size: string; min_value: string; max_value: string };

export type SizeChartMeasurement = {
  type_label: string;
  values: SizeChartMeasurementValue[];
};

export type SizeChartTable = {
  type: string;
  unit: string;
  description?: string;
  image_url?: string;
  measurements?: SizeChartMeasurement[];
};

export type SizeChartData = {
  availableSizes?: string[];
  sizeTables?: SizeChartTable[];
};
