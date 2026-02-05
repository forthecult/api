import { pgTable, text, integer } from "drizzle-orm/pg-core";

/**
 * Token gates for arbitrary page slugs (e.g. /about, /token).
 * When a slug has at least one row here, the page is token-gated.
 * User must hold >= quantity of ANY token (OR) to access.
 */
export const pageTokenGateTable = pgTable("page_token_gate", {
  id: text("id").primaryKey(),
  pageSlug: text("page_slug").notNull(), // e.g. "about", "token"
  tokenSymbol: text("token_symbol").notNull(),
  quantity: integer("quantity").notNull(),
  network: text("network"), // solana | ethereum | base | etc.
  contractAddress: text("contract_address"), // SPL mint or ERC20 contract
});
