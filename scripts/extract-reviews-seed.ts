/**
 * Pre-extracts review rows from data/reviews.csv into data/reviews-seed.json.
 *
 * Run locally when reviews.csv is updated: bun run db:extract-reviews
 *
 * The JSON is in the right shape for the DB (with productId null; productName
 * derived from slug). The seed script then only does: load JSON, one product
 * lookup, merge productId/productName, bulk insert — so CI seeding is fast.
 *
 * Date/time: createdAt and updatedAt are taken from the CSV created_at column
 * (required for correct review dates). If created_at is missing or invalid,
 * the extract falls back to "now" and logs a warning so the CSV can be fixed.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CSV_PATH = path.join(process.cwd(), "data", "reviews.csv");
const OUT_PATH = path.join(process.cwd(), "data", "reviews-seed.json");

interface CsvReview {
  product_handle: string;
  state: string;
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

function parseCsv(content: string): CsvReview[] {
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentLine += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentLine += char;
      }
    } else if (char === "\n" && !inQuotes) {
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);

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

function generateReviewId(
  productHandle: string,
  author: string,
  createdAt: string,
): string {
  const base = `${productHandle}-${author}-${createdAt}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash = hash & hash;
  }
  return `review-${Math.abs(hash).toString(36)}`;
}

function formatSlugAsName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Serializable row for reviews-seed.json (dates as ISO strings). */
export type ReviewSeedRow = {
  id: string;
  productId: null;
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
  createdAt: string;
  updatedAt: string;
  userId: null;
};

function run() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const allReviews = parseCsv(csvContent);
  const validReviews = allReviews.filter(
    (r) => r.state === "published" || r.state === "approved",
  );

  const rows: ReviewSeedRow[] = [];
  let skipped = 0;

  for (const review of validReviews) {
    const rating = parseInt(review.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      skipped++;
      continue;
    }

    let createdAt: Date;
    const rawCreatedAt = (review.created_at ?? "").trim();
    try {
      createdAt = new Date(rawCreatedAt);
      if (Number.isNaN(createdAt.getTime())) {
        console.warn(
          `Review ${review.product_handle} / ${review.author}: invalid or missing created_at "${rawCreatedAt}", using now`,
        );
        createdAt = new Date();
      }
    } catch {
      console.warn(
        `Review ${review.product_handle} / ${review.author}: created_at parse failed, using now`,
      );
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

    rows.push({
      id: reviewId,
      productId: null,
      productSlug: review.product_handle,
      productName: formatSlugAsName(review.product_handle),
      rating,
      title: review.title || null,
      comment: review.body || "Great product!",
      customerName,
      author: isAnonymous ? null : review.author,
      location: review.location || null,
      showName: !isAnonymous,
      visible: true,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      userId: null,
    });
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(rows, null, 0), "utf-8");

  console.log(`Wrote ${rows.length} review rows to ${OUT_PATH} (skipped ${skipped} invalid).`);
}

run();
