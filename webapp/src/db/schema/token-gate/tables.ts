import { integer, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Token gates for arbitrary page slugs (e.g. /about, /token).
 * When a slug has at least one row here, the page is token-gated.
 * User must hold >= quantity of ANY token (OR) to access.
 */
export const pageTokenGateTable = pgTable("page_token_gate", {
  contractAddress: text("contract_address"), // SPL mint or ERC20 contract
  id: text("id").primaryKey(),
  network: text("network"), // solana | ethereum | base | etc.
  pageSlug: text("page_slug").notNull(), // e.g. "about", "token"
  quantity: integer("quantity").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
});
