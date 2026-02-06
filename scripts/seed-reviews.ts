/**
 * Seeds the database with real product reviews from the CSV export.
 *
 * Reviews are stored with productSlug for matching to products.
 * Reviews can exist independently of products (productId nullable) for:
 * - Homepage testimonials and site-wide social proof
 * - Products that no longer exist or haven't been created yet
 * Only published and approved reviews are imported.
 * If data/reviews.csv is missing, the script exits 0 so staging seed can complete (shipping, products, etc.).
 *
 * Run: bun run db:seed-reviews
 */

import "dotenv/config";

import * as fs from "node:fs";
import * as path from "node:path";

import { db } from "../src/db";
import { productReviewsTable, productsTable } from "../src/db/schema";

// CSV path: prefer cwd (so CI with working-directory: relivator finds data/reviews.csv), else relative to script
const CSV_PATH = (() => {
  const fromCwd = path.join(process.cwd(), "data", "reviews.csv");
  if (fs.existsSync(fromCwd)) return fromCwd;
  return path.join(__dirname, "..", "data", "reviews.csv");
})();

interface CsvReview {
  product_handle: string;
  state: string; // "published" | "approved" | "spam"
  rating: string;
  title: string;
  author: string;
  email: string;
  location: string;
  body: string;
  reply: string;
  created_at: string;
  replied_at: string;
}

/**
 * Parse CSV content into review objects.
 * Handles quoted fields with commas and newlines.
 */
function parseCsv(content: string): CsvReview[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      // Check for escaped quote ("")
      if (inQuotes && content[i + 1] === '"') {
        currentLine += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === "\n" && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else {
      currentLine += char;
    }
  }

  // Don't forget the last line
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  // Skip header
  const [_header, ...dataLines] = lines;

  const reviews: CsvReview[] = [];

  for (const line of dataLines) {
    const fields = parseCSVLine(line);
    if (fields.length >= 10) {
      reviews.push({
        product_handle: fields[0] || "",
        state: fields[1] || "",
        rating: fields[2] || "",
        title: fields[3] || "",
        author: fields[4] || "",
        email: fields[5] || "",
        location: fields[6] || "",
        body: fields[7] || "",
        reply: fields[8] || "",
        created_at: fields[9] || "",
        replied_at: fields[10] || "",
      });
    }
  }

  return reviews;
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Generate a deterministic ID for a review based on its content.
 */
function generateReviewId(
  productHandle: string,
  author: string,
  createdAt: string,
): string {
  const base = `${productHandle}-${author}-${createdAt}`.toLowerCase();
  // Simple hash-like ID
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `review-${Math.abs(hash).toString(36)}`;
}

async function seed() {
  console.log("Seeding product reviews from CSV…");

  if (!fs.existsSync(CSV_PATH)) {
    console.warn(`Reviews CSV not found at: ${CSV_PATH}`);
    console.log("Skipping reviews seed. Add data/reviews.csv and re-run db:seed-reviews to import reviews.");
    // In CI, fail so the workflow does not silently skip reviews
    if (process.env.CI === "true") {
      console.error("Failing in CI because data/reviews.csv is required for staging.");
      process.exit(1);
    }
    return;
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const allReviews = parseCsv(csvContent);

  console.log(`Parsed ${allReviews.length} total reviews from CSV`);

  // Filter out spam reviews - only keep published and approved
  const validReviews = allReviews.filter(
    (r) => r.state === "published" || r.state === "approved",
  );

  console.log(
    `Filtered to ${validReviews.length} valid reviews (published/approved)`,
  );

  // Get all products with slugs for optional matching
  const products = await db
    .select({
      id: productsTable.id,
      slug: productsTable.slug,
      name: productsTable.name,
    })
    .from(productsTable);

  const slugToProduct = new Map<string, { id: string; name: string }>();
  for (const p of products) {
    if (p.slug) {
      slugToProduct.set(p.slug, { id: p.id, name: p.name });
    }
  }

  console.log(`Found ${slugToProduct.size} products with slugs in database`);

  // Build rows for batch insert (avoid one round-trip per review)
  const BATCH_SIZE = 150;
  const rows: Array<{
    id: string;
    productId: string | null;
    productSlug: string;
    productName: string;
    rating: number;
    title: string | null;
    comment: string;
    customerName: string;
    author: string | null;
    location: string | null;
    showName: boolean;
    visible: boolean;
    createdAt: Date;
    updatedAt: Date;
    userId: null;
  }> = [];
  let skipped = 0;

  for (const review of validReviews) {
    const rating = parseInt(review.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      skipped++;
      continue;
    }

    let createdAt: Date;
    try {
      createdAt = new Date(review.created_at);
      if (isNaN(createdAt.getTime())) {
        createdAt = new Date();
      }
    } catch {
      createdAt = new Date();
    }

    const reviewId = generateReviewId(
      review.product_handle,
      review.author,
      review.created_at,
    );
    const isAnonymous =
      review.author.toLowerCase() === "anonymous" || !review.author.trim();
    const customerName = isAnonymous ? "Anonymous" : review.author;
    const product = slugToProduct.get(review.product_handle);
    const productId = product?.id || null;
    const productName = product?.name || formatSlugAsName(review.product_handle);

    rows.push({
      id: reviewId,
      productId,
      productSlug: review.product_handle,
      productName,
      rating,
      title: review.title || null,
      comment: review.body || "Great product!",
      customerName,
      author: isAnonymous ? null : review.author,
      location: review.location || null,
      showName: !isAnonymous,
      visible: true,
      createdAt,
      updatedAt: createdAt,
      userId: null,
    });
  }

  let inserted = 0;
  let linked = 0;
  let unlinked = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    try {
      await db
        .insert(productReviewsTable)
        .values(chunk)
        .onConflictDoNothing({ target: productReviewsTable.id });
      inserted += chunk.length;
      for (const r of chunk) {
        if (r.productId) linked++;
        else unlinked++;
      }
    } catch (err) {
      console.error(`Batch insert failed at offset ${i}:`, err);
      // Fallback: insert one-by-one for this chunk so we don't lose progress
      for (const row of chunk) {
        try {
          await db
            .insert(productReviewsTable)
            .values(row)
            .onConflictDoNothing({ target: productReviewsTable.id });
          inserted++;
          if (row.productId) linked++;
          else unlinked++;
        } catch (e) {
          console.error(`Failed to insert review ${row.id}:`, e);
          skipped++;
        }
      }
    }
  }

  console.log("\n--- Seed Results ---");
  console.log(`Inserted: ${inserted} reviews`);
  console.log(`  - Linked to products: ${linked}`);
  console.log(`  - Unlinked (standalone): ${unlinked}`);
  console.log(`Skipped (invalid rating): ${skipped} reviews`);

  if (unlinked > 0) {
    console.log(
      "\nUnlinked reviews are still visible and can be displayed on homepage/testimonials.",
    );
    console.log(
      "They will auto-link when products with matching slugs are added.",
    );
  }

  console.log("\nDone.");
}

/**
 * Convert a slug to a readable product name (fallback when product doesn't exist).
 * e.g. "bitcoin-socks" -> "Bitcoin Socks"
 */
function formatSlugAsName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

seed().catch((err) => {
  console.error("Seed reviews failed:", err);
  process.exit(1);
});
