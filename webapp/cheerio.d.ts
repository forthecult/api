/**
 * Declare cheerio for scripts that are excluded from tsconfig but may be
 * type-checked in some build environments (e.g. Railway).
 */
declare module "cheerio" {
  const load: (html: string) => unknown;
  export = load;
}
