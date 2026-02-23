import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { openApiSpec } from "../src/lib/openapi";

// write to repo api/docs so the API folder owns the canonical spec
const outPath = join(process.cwd(), "..", "api", "docs", "openapi.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(openApiSpec, null, 2), "utf-8");
console.log("Wrote", outPath);
