<!-- INTERNAL — DO NOT PUBLISH. Contains sensitive configuration details. -->
<!-- If this repository is public, move this file outside the repo or add it to .gitignore. -->
# Using the POD Product Creation System

This doc explains how to use the admin POD (Print-on-Demand) APIs to create products from an image—with or without an LLM in the loop.

## How it works today

1. **Catalog** – You (or an AI) list blueprints and get print specs (sizes, positions like "front"/"back").
2. **Image** – You provide an image (upload to Printify, or a public URL for Printful).
3. **Create** – You call the create (or bulk) API with blueprint IDs, image, title, description, and placement strategy. The API creates the product(s) on Printify/Printful and returns **mockup URLs** in the response.
4. **Sync** – If you set `syncToStore: true`, the product is imported into your store; otherwise it stays only on the provider (e.g. for one-off prints).

There is **no separate “preview only” step** in the current implementation: you create the product and get mockups in the same response. A common pattern is: create one product, check the mockup URLs, then run bulk create for the rest if you’re happy.

---

## Option 1: Use an LLM that can call your API (e.g. Claude with tools)

If Claude (or another model) has **tools** that call your backend, you can work in natural language and have the AI drive the flow.

**What you need**

- Your app (or a thin backend) exposes the POD endpoints and gives the LLM **tools** that map to:
  - List catalog: `GET /api/admin/pod/catalog?provider=printify&search=tee`
  - Get blueprint details: `GET /api/admin/pod/catalog/{blueprintId}?provider=printify&printProviderId=99`
  - Upload image: `POST /api/admin/pod/upload` (FormData with `file`; query `provider=printify`)
  - Create one product: `POST /api/admin/pod/products`
  - Bulk create: `POST /api/admin/pod/bulk`
- Admin auth: either **session** (admin logged in) or **API key** (`Authorization: Bearer <ADMIN_API_KEY>` or `X-API-Key: <ADMIN_API_KEY>`).

**Example flow in a chat**

- You: “I want to put this design [attach image] on a unisex tee and a hoodie from Printify. Show me one mockup first, then create both and add them to the store.”
- The AI can:
  1. Call catalog search → get blueprint IDs for “unisex tee” and “hoodie”.
  2. Call upload with your image → get `imageId` (Printify).
  3. Call create product for **one** blueprint (e.g. tee) with `syncToStore: false` → get back `mockupUrls`.
  4. Show you the mockup URLs and ask: “Mockup for the tee is at [url]. Create both products and add to store?”
  5. If you say yes: call create (or bulk) for both with `syncToStore: true`.

So: **yes, you can work inside an LLM (e.g. Claude Sonnet 4.5)** and have it “first give a mockup, then create all the products” by having the model use tools that hit these APIs. The mockup is the one returned from the first create; then the model can create the rest (and optionally sync to your store).

---

## Option 2: Use Cursor (or another agent) to call the API

In Cursor you can say things like:

- “Call our admin API to list Printify blueprints for ‘t-shirt’.”
- “Upload this image to Printify and create a product on blueprint 6, print provider 99, title ‘Summer Logo Tee’, sync to store.”

The agent can run `curl` or a small script that uses the same endpoints. Auth: set `ADMIN_API_KEY` in `.env` and pass it as `Authorization: Bearer $ADMIN_API_KEY` (or use session cookies if the agent is driving a browser).

---

## Option 3: Script or admin UI (no LLM)

You can drive everything with a script or a simple admin page:

1. **List blueprints**  
   `GET /api/admin/pod/catalog?provider=printify&search=hoodie`
2. **Upload image**  
   `POST /api/admin/pod/upload` with FormData `file` and `?provider=printify`
3. **Create one product** (to get a mockup)  
   `POST /api/admin/pod/products` with body below; use the `mockupUrls` in the response as the “mockup.”
4. **Bulk create** (if you’re happy)  
   `POST /api/admin/pod/bulk` with the same image (base64 or URL) and multiple targets.

No LLM required; the “mockup” is just the first product’s response.

---

## Auth

- **Session**: log in as an admin user (email in `ADMIN_EMAILS`); cookies are sent with requests.
- **API key**: set `ADMIN_API_KEY` in `.env`, then:
  - Header: `Authorization: Bearer <ADMIN_API_KEY>` or `X-API-Key: <ADMIN_API_KEY>`

Use the API key when calling from an LLM tool, script, or another service.

---

## Example: create one product (get mockup in response)

**1. Upload image (Printify)**

```bash
curl -X POST "https://your-store.com/api/admin/pod/upload?provider=printify" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -F "file=@/path/to/design.png"
```

Response includes `imageId` and `imageUrl`. Use `imageId` for Printify create.

**2. Get a blueprint (e.g. Unisex Heavy Cotton Tee)**

```bash
curl "https://your-store.com/api/admin/pod/catalog?provider=printify&search=heavy%20cotton"
# Pick blueprint id and a print_provider_id (e.g. 99). Then:

curl "https://your-store.com/api/admin/pod/catalog/6?provider=printify&printProviderId=99" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
# Use variant ids from the response.
```

**3. Create product (mockup URLs in response)**

```bash
curl -X POST "https://your-store.com/api/admin/pod/products" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "printify",
    "blueprintId": "6",
    "printProviderId": 99,
    "title": "Summer Logo Tee",
    "description": "Unisex heavy cotton tee with design.",
    "image": { "id": "IMAGE_ID_FROM_UPLOAD_STEP" },
    "printAreas": [
      { "position": "front", "strategy": "center" }
    ],
    "variants": [
      { "id": 17390, "enabled": true, "priceCents": 2499 },
      { "id": 17391, "enabled": true, "priceCents": 2499 }
    ],
    "syncToStore": true,
    "publish": true
  }'
```

Response includes `mockupUrls` — that’s your mockup. If you like it, use the same image and options in a bulk request for more products.

---

## Example: bulk create (one image, many products)

Body: `image` as **base64 string** (Printify) or **public URL string** (Printful). Same auth as above.

```bash
curl -X POST "https://your-store.com/api/admin/pod/bulk" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "BASE64_STRING_OR_PUBLIC_IMAGE_URL",
    "title": "Summer Logo Collection",
    "description": "Same design across multiple products.",
    "targets": [
      {
        "provider": "printify",
        "blueprintId": "6",
        "printProviderId": 99,
        "positions": ["front"],
        "placementStrategy": "center",
        "pricing": { "type": "markup_percent", "value": 30 }
      },
      {
        "provider": "printify",
        "blueprintId": "12",
        "printProviderId": 99,
        "positions": ["front"],
        "placementStrategy": "center",
        "pricing": { "type": "markup_percent", "value": 30 }
      }
    ],
    "syncToStore": true
  }'
```

Response: `products[]` (each with `externalProductId`, `mockupUrls`) and `errors[]` for any failures.

---

## Summary

| Question | Answer |
|----------|--------|
| Can I work inside an LLM (e.g. Claude Sonnet 4.5) with a prompt/image and a list of products? | **Yes**, if that LLM has **tools** that call your admin POD API (catalog, upload, create, bulk). You give the image + products; the AI calls the APIs and can show mockups from the first create, then create the rest. |
| Does the AI “first give a mockup, then create”? | **Yes**, by having the AI create **one** product first, return the `mockupUrls` to you, then call create/bulk for the rest after you confirm (or in one go if you don’t need confirmation). |
| Another way? | **Yes**: use Cursor/agent with curl or a script, or a small admin UI that calls the same endpoints; no LLM required. Mockup = first create response’s `mockupUrls`. |

To enable the “Claude + tools” flow, add a thin layer that exposes these admin endpoints as tools (e.g. OpenAPI or a small tool schema) and pass your `ADMIN_API_KEY` when the model calls them.
                                                                                                                                                                                                                                                  