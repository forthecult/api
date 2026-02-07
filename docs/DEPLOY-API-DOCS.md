# Deploying API docs for public consumption

Ways to make your API and OpenAPI docs available publicly.

---

## 1. Docs are already on GitHub (no deploy)

If your repo is **public**:

- **OpenAPI spec (raw)**  
  `https://github.com/<org>/<repo>/blob/main/relivator/docs/openapi.json`  
  Or raw:  
  `https://raw.githubusercontent.com/<org>/<repo>/main/relivator/docs/openapi.json`

- **Markdown docs**  
  All files in `relivator/docs/` (e.g. `Culture Store API.md`) are viewable on GitHub.

**Consumption:** People can open the spec in Swagger Editor, Postman, or code generators by using the raw URL. No deployment needed.

---

## 2. GitHub Pages (readable docs site)

Host a small site that shows your OpenAPI spec with Swagger UI or Redoc.

### Option A: GitHub Pages from `docs/` (included in this repo)

This repo includes `docs/index.html` (Redoc viewer) and `docs/openapi.json`. To publish:

1. **Regenerate the spec** (optional): from repo root run  
   `bun run generate:openapi`  
   so `docs/openapi.json` is up to date, then commit.

2. **Enable GitHub Pages**  
   On GitHub: **Settings** → **Pages** → **Build and deployment**  
   - Source: **Deploy from a branch**  
   - Branch: **main** (or your default branch)  
   - Folder: **/docs**  
   - Save.

3. **Result**  
   After a minute or two, the site is at  
   `https://<username>.github.io/<repo>/`  
   and shows the API reference. The viewer loads `openapi.json` from the same origin.

**Note:** The docs folder must contain `index.html` and `openapi.json`. Other files (e.g. `*.md`) remain in the repo but are not used by the Redoc page; link to them from the repo or from `index.html` if you want.

### Option B: Build a small docs site and deploy to GitHub Pages

Use a static-site generator (e.g. [Redoc](https://redocly.com/docs/redoc/quickstart/), [MkDocs](https://www.mkdocs.org/), or a one-page HTML that embeds Swagger UI). Build to a folder (e.g. `out/` or `build/`), then push that folder to a branch like `gh-pages` or use GitHub Actions to publish it.  
(We can add a minimal example in this repo if you want.)

---

## 3. Live API + docs (your deployed app)

Your **API** runs where you deploy the app (e.g. Railway, Vercel):

- **Live OpenAPI spec:** `https://<your-domain>/api/openapi.json`
- **Interactive docs:** `https://<your-domain>/api/docs` (Swagger UI in your app)

So “deploying the API for public consumption” = deploying the app and sharing:

- Base URL: `https://<your-domain>`
- Spec URL: `https://<your-domain>/api/openapi.json`
- Docs URL: `https://<your-domain>/api/docs`

No extra “deploy to GitHub” step for the API itself; GitHub holds the code, your host runs it.

---

## Summary

| Goal                         | What to do |
|-----------------------------|------------|
| Spec and .md visible        | Public repo; share links to `docs/openapi.json` and `docs/*.md`. |
| Nice docs site on the web   | GitHub Pages + one HTML page (or static site) that loads the spec. |
| Live API + interactive docs | Deploy the app; share `/api/openapi.json` and `/api/docs`. |

**Regenerating the static spec:**  
`bun run generate:openapi` writes `docs/openapi.json`. Run that and commit when you change the API so the file on GitHub (and any Pages viewer) stays in sync.
