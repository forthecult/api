# Print-on-Demand Webhook Setup Guide

This document explains how to set up webhooks for Printify and Printful to enable automatic product syncing and order status updates.

## Overview

Both Printify and Printful use webhooks to notify your application when:
- **Products** are created, updated, or deleted
- **Orders** are created, updated, shipped, or delivered

Without webhooks, you must manually sync products. With webhooks, products and order statuses update automatically.

---

## Environment Variables

Add these to your `.env` file:

```bash
# Printify
PRINTIFY_API_TOKEN=your_printify_api_token
PRINTIFY_SHOP_ID=your_printify_shop_id
PRINTIFY_WEBHOOK_SECRET=your_random_secret_string  # Optional but recommended

# Printful
PRINTFUL_API_TOKEN=your_printful_api_token
PRINTFUL_WEBHOOK_SECRET=your_hex_encoded_secret    # Optional but recommended
```

### Getting API Tokens

**Printify:**
1. Go to [Printify Dashboard](https://printify.com) → Settings → Connections
2. Create a new API token with appropriate permissions
3. Your Shop ID is visible in the URL when viewing your shop

**Printful:**
1. Go to [Printful Dashboard](https://www.printful.com) → Settings → API
2. Create a new API token
3. For webhook secret, Printful uses a hex-encoded string (you'll get this when setting up webhooks)

---

## Webhook Endpoints

Your application exposes these webhook endpoints:

| Provider | Endpoint | Purpose |
|----------|----------|---------|
| Printify | `/api/webhooks/printify` | Receives Printify events |
| Printful | `/api/webhooks/printful` | Receives Printful events |

---

## Registering Webhooks

### Printify Webhooks

Printify requires **programmatic webhook registration** via their API. Use the admin endpoint:

**1. Check current webhook status:**

```bash
# In browser console (logged in as admin):
fetch('/api/admin/printify/webhooks', { credentials: 'include' })
  .then(r => r.json()).then(console.log)

# Or via curl:
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  https://your-domain.com/api/admin/printify/webhooks
```

**2. Register all webhooks:**

```bash
# In browser console:
fetch('/api/admin/printify/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'register_all' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)

# Or via curl:
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "register_all"}' \
  https://your-domain.com/api/admin/printify/webhooks
```

**3. Delete all webhooks (if needed):**

```bash
fetch('/api/admin/printify/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'delete_all' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

**Printify webhook events registered:**
- `product:publish:started` - Product publishing started
- `product:published` - Product published (triggers import)
- `product:deleted` - Product deleted
- `order:created` - Order created
- `order:updated` - Order status changed
- `order:sent-to-production` - Order in production
- `order:shipment:created` - Shipment created
- `order:shipment:delivered` - Order delivered
- `shop:disconnected` - Shop disconnected

### Printful Webhooks

Printful also requires **programmatic webhook registration**:

**1. Check current webhook status:**

```bash
fetch('/api/admin/printful/webhooks', { credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

**2. Register all webhooks:**

```bash
fetch('/api/admin/printful/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'register_all' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

**3. Disable webhooks (if needed):**

```bash
fetch('/api/admin/printful/webhooks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'disable' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

**Printful webhook events registered:**
- `package_shipped` - Package shipped
- `package_returned` - Package returned
- `order_created` - Order created
- `order_updated` - Order status changed
- `order_failed` - Order failed
- `order_canceled` - Order cancelled
- `order_put_hold` - Order on hold
- `order_put_hold_approval` - Order waiting approval
- `order_remove_hold` - Order removed from hold
- `product_synced` - Product synced
- `product_updated` - Product updated
- `product_deleted` - Product deleted
- `stock_updated` - Stock changed

---

## Order Processing Flow

When a customer places an order with POD items:

1. **Payment confirmed** → Your app calls `createAndConfirmPrintifyOrder()` or `createAndConfirmPrintfulOrder()`
2. **Order sent to provider** → Provider creates the order and starts production
3. **Webhook: order:sent-to-production** → Your app updates order status to "processing"
4. **Webhook: package_shipped / order:shipment:created** → Your app updates to "shipped" and notifies customer
5. **Webhook: shipment_delivered** → Your app marks order as "fulfilled"

### Customer Notifications

When order status changes, customers are notified via:
- **Website notification** (if enabled in preferences)
- **Telegram** (if linked and opted in)
- **Email** (for shipped orders, if enabled)

---

## Manual Sync (Fallback)

If webhooks aren't working, you can manually sync:

**Printify:**
```bash
# Import all products
fetch('/api/admin/printify/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'import_all' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)

# Import single product
fetch('/api/admin/printify/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    action: 'import_single', 
    printifyProductId: 'PRODUCT_ID_FROM_PRINTIFY' 
  }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

**Printful:**
```bash
# Sync all products
fetch('/api/admin/printful/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'sync_all' }),
  credentials: 'include'
}).then(r => r.json()).then(console.log)
```

---

## Troubleshooting

### Webhooks not firing

1. **Check webhook registration:**
   ```bash
   fetch('/api/admin/printify/webhooks').then(r => r.json()).then(console.log)
   fetch('/api/admin/printful/webhooks').then(r => r.json()).then(console.log)
   ```

2. **Verify your app URL is accessible:**
   - Webhooks require a publicly accessible HTTPS URL
   - `NEXT_PUBLIC_APP_URL` must be set correctly
   - Test: `curl https://your-domain.com/api/webhooks/printify` should return `{"status":"ok"}`

3. **Check logs:**
   - Railway: View logs in the Railway dashboard
   - Local: Check terminal output

### Products not syncing

1. **Verify product is published** in Printify/Printful dashboard
2. **Check if webhook was received** in logs
3. **Try manual sync** as fallback

### Orders not updating

1. **Verify order has provider ID** (`printifyOrderId` or `printfulOrderId` in database)
2. **Check webhook secret** matches between provider and your `.env`
3. **Review webhook payload** in logs

---

## Security

### Printify
- Uses URL-based secret: `?secret=YOUR_SECRET`
- Set `PRINTIFY_WEBHOOK_SECRET` in `.env`
- Webhook URL becomes: `https://your-domain.com/api/webhooks/printify?secret=YOUR_SECRET`

### Printful
- Uses HMAC-SHA256 signature verification
- Set `PRINTFUL_WEBHOOK_SECRET` in `.env` (hex-encoded)
- Signature sent in `x-pf-webhook-signature` header

---

## Quick Setup Checklist

- [ ] Set `PRINTIFY_API_TOKEN` and `PRINTIFY_SHOP_ID` in `.env`
- [ ] Set `PRINTFUL_API_TOKEN` in `.env`
- [ ] Set `NEXT_PUBLIC_APP_URL` to your public domain
- [ ] Deploy your application
- [ ] Register Printify webhooks: `POST /api/admin/printify/webhooks { action: "register_all" }`
- [ ] Register Printful webhooks: `POST /api/admin/printful/webhooks { action: "register_all" }`
- [ ] Test by creating a product in Printify/Printful and verifying it appears in your store
- [ ] Test order flow by placing a test order

---

## API Reference

### Printify Webhook Admin Endpoint

`GET /api/admin/printify/webhooks`
- Returns current webhook configuration and missing topics

`POST /api/admin/printify/webhooks`
- Body: `{ action: "register_all" }` - Register all required webhooks
- Body: `{ action: "register", topic: "product:published" }` - Register single webhook
- Body: `{ action: "delete", webhookId: "abc123" }` - Delete specific webhook
- Body: `{ action: "delete_all" }` - Delete all webhooks

### Printful Webhook Admin Endpoint

`GET /api/admin/printful/webhooks`
- Returns current webhook configuration and missing types

`POST /api/admin/printful/webhooks`
- Body: `{ action: "register_all" }` - Register all required webhooks
- Body: `{ action: "register", types: ["product_synced"] }` - Register specific types
- Body: `{ action: "disable" }` - Disable all webhooks
