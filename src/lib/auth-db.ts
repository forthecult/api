import { execaCommand } from "execa";
import fs from "fs-extra";
import MagicString from "magic-string";
import path from "pathe";

const configPath = "./src/lib/auth.ts";
const schemaPath = "./src/db/schema/users/tables.ts";
// Generate to a temp file so the CLI can read auth.ts (which imports from schema)
// without the schema being clobbered mid-run.
const tempSchemaPath = "./src/db/schema/users/tables.generated.ts";

async function main() {
  // 1. Generate to a TEMP file (auth.ts imports from schema, so the real tables.ts must stay valid)
  await execaCommand(
    `npx @better-auth/cli@latest generate --config ${configPath} --output ${tempSchemaPath}`,
    { stdio: "inherit" },
  );

  const tempFilePath = path.resolve(tempSchemaPath);
  let content = await fs.readFile(tempFilePath, "utf8");

  // 2. Remove generated relations block (relations live in users/relations.ts)
  const relationsIdx = content.indexOf(
    "export const userRelations = relations(",
  );
  if (relationsIdx !== -1) {
    // Find the start of the line (include preceding newlines)
    let start = relationsIdx;
    while (start > 0 && content[start - 1] === "\n") start--;
    content = `${content.slice(0, start).replace(/\n+$/, "")}\n`;
  }
  // Remove the relations import (no longer needed)
  content = content.replace(
    /\n?import \{ relations \} from "drizzle-orm";\n?/,
    "\n",
  );

  // 3. Post-process with MagicString
  const s = new MagicString(content);

  const notice = `/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
 *
 * To modify the schema, edit src/lib/auth.ts instead,
 * then run 'bun db:auth' to regenerate this file.
 * After regenerating, run 'bun db:push' so the database matches the new schema;
 * otherwise sign-in/sign-up can return 500.
 *
 * Any direct changes to this file will be overwritten.
 */

`;
  s.prepend(notice);

  // Rename table exports: user -> userTable, session -> sessionTable, etc.
  s.replace(
    /export const (\w+) = pgTable/g,
    (_match: string, tableName: string) => {
      return `export const ${tableName}Table = pgTable`;
    },
  );

  // Collect original table names for reference renaming
  const tableNames: string[] = [];
  const tableMatches = content.matchAll(/export const (\w+) = pgTable/g);
  for (const match of tableMatches) {
    if (match[1]) tableNames.push(match[1]);
  }
  console.log("√ Ensured better-auth tables:", tableNames);

  // Rename references: () => user.id -> () => userTable.id
  for (const tableName of tableNames) {
    s.replace(
      new RegExp(`\\(\\)\\s*=>\\s*${tableName}\\s*\\.`, "g"),
      (match: string) => match.replace(tableName, `${tableName}Table`),
    );
  }

  // 4. Inject business-only user columns (notification prefs, theme, etc.)
  const userTableClose =
    / {2}twoFactorEnabled: boolean\("two_factor_enabled"\),\n\}\);/;
  if (userTableClose.test(s.toString())) {
    s.replace(
      userTableClose,
      `  twoFactorEnabled: boolean("two_factor_enabled"),
  // Notification preferences - Transactional (per channel)
  transactionalEmail: boolean("transactional_email").notNull().default(true),
  transactionalWebsite: boolean("transactional_website").notNull().default(true),
  transactionalSms: boolean("transactional_sms").notNull().default(false),
  transactionalTelegram: boolean("transactional_telegram").notNull().default(false),
  transactionalDiscord: boolean("transactional_discord").notNull().default(false),
  transactionalAiCompanion: boolean("transactional_ai_companion").notNull().default(false),
  // Notification preferences - Marketing (per channel)
  marketingEmail: boolean("marketing_email").notNull().default(true),
  marketingWebsite: boolean("marketing_website").notNull().default(false),
  marketingSms: boolean("marketing_sms").notNull().default(false),
  marketingTelegram: boolean("marketing_telegram").notNull().default(false),
  marketingDiscord: boolean("marketing_discord").notNull().default(false),
  marketingAiCompanion: boolean("marketing_ai_companion").notNull().default(false),
  // Legacy fields (kept for backward compatibility)
  receiveMarketing: boolean("receive_marketing").notNull().default(false),
  receiveSmsMarketing: boolean("receive_sms_marketing").notNull().default(false),
  receiveOrderNotificationsViaTelegram: boolean("receive_order_notifications_via_telegram").notNull().default(false),
  /** UI theme: "light" | "dark" | "system". Persisted for logged-in users. */
  theme: text("theme").default("system"),
});`,
    );
  }

  // 5. Write the final file to the real schema path, then clean up temp
  const finalPath = path.resolve(schemaPath);
  await fs.writeFile(finalPath, s.toString(), "utf8");
  await fs.remove(tempFilePath);

  // 6. Format
  await execaCommand("bun biome check --write .", {
    stdio: "inherit",
  });
}

await main().catch((error: unknown) => {
  console.error("Error:", error);
  process.exit(1);
});
