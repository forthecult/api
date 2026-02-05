import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { openApiSpec } from "../src/lib/openapi";

const outPath = join(process.cwd(), "docs", "openapi.json");
writeFileSync(outPath, JSON.stringify(openApiSpec, null, 2), "utf-8");
console.log("Wrote", outPath);
