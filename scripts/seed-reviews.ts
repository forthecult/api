/**
 * Seeds the database with real product reviews from the CSV export.
 *
 * Reviews are stored with productSlug for matching to products.
 * Reviews can exist independently of products (for homepage testimonials,
 * archived products, etc.). Only published and approved reviews are imported.
 *
 * Run: bun run db:seed-reviews
 */

import "dotenv/config";

import { eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";

import { db } from "../src/db";
import { productReviewsTable, productsTable } from "../src/db/schema";

// CSV file path (relative to project root)
const CSV_PATH = path.join(__dirname, "../data/reviews.csv");

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

  // Check if CSV exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV file not found at: ${CSV_PATH}`);
    console.log("Please ensure the reviews CSV is at: data/reviews.csv");
    process.exit(1);
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

  let inserted = 0;
  let skipped = 0;
  let linked = 0;
  let unlinked = 0;

  for (const review of validReviews) {
    const rating = parseInt(review.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      skipped++;
      continue;
    }

    // Parse the date
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

    // Determine display name and anonymous flag
    const isAnonymous =
      review.author.toLowerCase() === "anonymous" || !review.author.trim();
    const customerName = isAnonymous ? "Anonymous" : review.author;

    // Try to match to existing product (optional)
    const product = slugToProduct.get(review.product_handle);
    const productId = product?.id || null;
    const productName = product?.name || formatSlugAsName(review.product_handle);

    try {
      await db
        .insert(productReviewsTable)
        .values({
          id: reviewId,
          productId, // null if product doesn't exist
          productSlug: review.product_handle, // always store for matching/display
          productName, // snapshot for display
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
          userId: null, // Imported reviews don't have user accounts
        })
        .onConflictDoNothing({ target: productReviewsTable.id });

      inserted++;
      if (productId) {
        linked++;
      } else {
        unlinked++;
      }
    } catch (err) {
      console.error(`Failed to insert review ${reviewId}:`, err);
      skipped++;
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
