import { relations } from "drizzle-orm";

import { addressesTable } from "../addresses/tables";
import { ordersTable } from "../orders/tables";
import { supportTicketTable } from "../support-tickets/tables";
import { uploadsTable } from "../uploads/tables";
import { userWalletsTable } from "../wallets/tables";
import { wishlistTable } from "../wishlist/tables";
import {
  accountTable,
  passkeyTable,
  sessionTable,
  twoFactorTable,
  userTable,
} from "./tables";

export const userRelations = relations(userTable, ({ many }) => ({
  // "account" is required by Better Auth findUserByEmail(..., { includeAccounts: true })
  account: many(accountTable),
  accounts: many(accountTable),
  addresses: many(addressesTable),
  orders: many(ordersTable),
  sessions: many(sessionTable),
  supportTickets: many(supportTicketTable),
  uploads: many(uploadsTable),
  wallets: many(userWalletsTable),
  wishlist: many(wishlistTable),
}));

export const sessionRelations = relations(sessionTable, ({ one }) => ({
  user: one(userTable, {
    fields: [sessionTable.userId],
    references: [userTable.id],
  }),
}));

export const accountRelations = relations(accountTable, ({ one }) => ({
  user: one(userTable, {
    fields: [accountTable.userId],
    references: [userTable.id],
  }),
}));

export const twoFactorRelations = relations(twoFactorTable, ({ one }) => ({
  user: one(userTable, {
    fields: [twoFactorTable.userId],
    references: [userTable.id],
  }),
}));

export const passkeyRelations = relations(passkeyTable, ({ one }) => ({
  user: one(userTable, {
    fields: [passkeyTable.userId],
    references: [userTable.id],
  }),
}));
