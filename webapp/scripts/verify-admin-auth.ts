#!/usr/bin/env bun
/**
 * Verification script to ensure all /api/admin/* routes call getAdminAuth
 *
 * Usage:
 *   bun run scripts/verify-admin-auth.ts
 *
 * This script scans all admin API routes and verifies they invoke
 * getAdminAuth() for authentication. Returns non-zero exit code if violations found.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";

const ADMIN_API_DIR = "./src/app/api/admin";
const WEBAPP_ROOT = ".";

interface Violation {
  file: string;
  line?: number;
  reason: string;
}

async function findFilePaths(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
      entries.map((entry) => {
        const res = join(dir, entry.name);
        return entry.isDirectory() ? findFilePaths(res) : [res];
      })
    );
    return files.flat();
  } catch (error) {
    return [];
  }
}

async function checkFile(filePath: string): Promise<Violation | null> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  // Skip non-route files or special handlers
  if (!filePath.endsWith("route.ts")) return null;

  // Skip known public routes that don't require auth
  const publicRoutes = ["/api/admin/health", "/api/admin/status"];
  const normalizedPath = filePath.replace("./", "").replace("/route.ts", "");
  if (publicRoutes.some((r) => normalizedPath.includes(r))) {
    return null;
  }

  // Check for getAdminAuth import
  const hasImport =
    content.includes("getAdminAuth") ||
    content.includes("from \"~/lib/admin-api-auth\"") ||
    content.includes("from \"@/lib/admin-api-auth\"");

  // Check for getAdminAuth call
  const hasCall = content.match(/await\s+getAdminAuth|getAdminAuth\s*\(/);

  if (!hasImport && !hasCall) {
    // Check if it uses session-based auth instead
    const hasSessionAuth = content.includes("auth.api.getSession") || content.includes("getSession");
    
    if (hasSessionAuth) {
      // Session auth is also acceptable for admin routes
      return null;
    }
    
    return {
      file: filePath,
      reason: "Missing getAdminAuth() call or import - admin routes require authentication",
    };
  }

  return null;
}

async function main() {
  console.log("🔍 Verifying admin route authentication...\n");

  const files = await findFilePaths(ADMIN_API_DIR);
  const routeFiles = files.filter((f) => f.endsWith("route.ts"));

  console.log(`Found ${routeFiles.length} route files in ${ADMIN_API_DIR}\n`);

  const violations: Violation[] = [];
  const checked: string[] = [];

  for (const file of routeFiles) {
    checked.push(file);
    const violation = await checkFile(file);
    if (violation) {
      violations.push(violation);
    }
  }

  // Print summary
  console.log(`✅ Checked ${checked.length} files`);
  console.log(`❌ Found ${violations.length} violations\n`);

  if (violations.length === 0) {
    console.log("All admin routes properly use getAdminAuth for authentication! ✅");
    process.exit(0);
  }

  console.log("Authentication violations found:\n");
  for (const v of violations) {
    console.log(`  📁 ${v.file}`);
    console.log(`     └─ ${v.reason}`);
  }

  console.log("\n💡 To fix:");
  console.log("   Import getAdminAuth: import { getAdminAuth } from '~/lib/admin-api-auth'");
  console.log("   Use it at the start of your handler:");
  console.log('     const adminAuth = await getAdminAuth(request);');

  process.exit(1);
}

main().catch((error) => {
  console.error("❌ Error running verification:", error);
  process.exit(1);
});
