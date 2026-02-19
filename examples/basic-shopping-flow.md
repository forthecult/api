# Basic Shopping Flow

Step-by-step walkthrough of a complete shopping flow from browsing to checkout.

---

## Step 1: Check API Health

```bash
curl https://forthecult.store/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-02-10T12:00:00Z"
}
```

## Step 2: Browse Categories

```bash
curl https://forthecult.store/api/categories
```

**Response:**
```json
{
  "categories": [
    {
      "id": "cat_apparel",
      "name": "Apparel",
      "description": "Quality clothing and accessories",
      "slug": "apparel",
      "productCount": 42,
      "subcategories": [
        {
          "id": "cat_hoodies",
          "name": "Hoodies",
          "slug": "hoodies",
          "productCount": 12
        },
        {
          "id": "cat_tshirts",
          "name": "T-Shirts",
          "slug": "tshirts",
          "productCount": 18
        }
      ]
    }
  ]
}
```

## Step 3: Search for Products

```bash
# Semantic search -- natural language works!
curl "https://forthecult.store/api/products/search?q=comfortable+black+hoodie&limit=5"
```

**Response:**
```json
{
  "products": [
    {
      "id": "prod_black_hoodie_001",
      "name": "Premium Black Hoodie",
      "slug": "premium-black-hoodie",
      "description": "Ultra-soft cotton blend, perfect for any season",
      "price": {
        "usd": 79.99,
        "crypto": {
          "SOL": "0.5",
          "USDC": "79.99",
          "ETH": "0.025"
        }
      },
      "imageUrl": "https://forthecult.store/images/black-hoodie.jpg",
      "category": "Hoodies",
      "inStock": true
    }
  ],
  "total": 8,
  "pagination": {
    "limit": 5,
    "offset": 0,
    "hasMore": true
  }
}
```

## Step 4: Get Product Details

```bash
curl https://forthecult.store/api/products/premium-black-hoodie
```

**Response:**
```json
{
  "id": "prod_black_hoodie_001",
  "name": "Premium Black Hoodie",
  "slug": "premium-black-hoodie",
  "description": "Ultra-soft cotton blend hoodie. Perfect weight for layering or wearing alone. Features kangaroo pocket and adjustable drawstring hood.",
  "price": {
    "usd": 79.99,
    "crypto": {
      "SOL": "0.5",
      "USDC": "79.99",
      "ETH": "0.025",
      "BTC": "0.0012"
    }
  },
  "images": [
    "https://forthecult.store/images/black-hoodie-front.jpg",
    "https://forthecult.store/images/black-hoodie-back.jpg"
  ],
  "variants": [
    {
      "id": "var_hoodie_s_black",
      "name": "Black / S",
      "sku": "HOD-BLK-S",
      "inStock": true,
      "stockQuantity": 15
    },
    {
      "id": "var_hoodie_m_black",
      "name": "Black / M",
      "sku": "HOD-BLK-M",
      "inStock": true,
      "stockQuantity": 23
    },
    {
      "id": "var_hoodie_l_black",
      "name": "Black / L",
      "sku": "HOD-BLK-L",
      "inStock": true,
      "stockQuantity": 18
    },
    {
      "id": "var_hoodie_xl_black",
      "name": "Black / XL",
      "sku": "HOD-BLK-XL",
      "inStock": false,
      "stockQuantity": 0
    }
  ],
  "category": "Hoodies",
  "tags": ["comfortable", "cotton", "streetwear", "essential"]
}
```

## Step 5: Check Available Payment Methods

```bash
curl https://forthecult.store/api/chains
```

**Response:**
```json
{
  "chains": [
    {
      "id": "solana",
      "name": "Solana",
      "tokens": [
        {
          "symbol": "SOL",
          "name": "Solana",
          "type": "native",
          "decimals": 9
        },
        {
          "symbol": "USDC",
          "name": "USD Coin",
          "type": "spl",
          "decimals": 6,
          "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        }
      ]
    },
    {
      "id": "ethereum",
      "name": "Ethereum",
      "tokens": [
        {
          "symbol": "ETH",
          "name": "Ethereum",
          "type": "native",
          "decimals": 18
        },
        {
          "symbol": "USDC",
          "name": "USD Coin",
          "type": "erc20",
          "decimals": 6,
          "mint": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        }
      ]
    }
  ]
}
```

## Step 6: Create Order

**Important:** Use the product **`id`** from the search or product-detail response (e.g. Step 3 or 4). Do not use placeholder IDs from examples—they may not exist in production. Each item needs `productId` (required) and `quantity`; `variantId` is optional.

Request body must use **`payment`** (with `chain` and `token`) and **`shipping`** (with `address1`, `stateCode`, `zip`, `countryCode`), not top-level `chain`/`token` or `shippingAddress`/`line1`/`state`/`postalCode`/`country`.

```bash
curl -X POST https://forthecult.store/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": "<use id from search or product detail>", "quantity": 1 }
    ],
    "email": "customer@example.com",
    "payment": { "chain": "solana", "token": "USDC" },
    "shipping": {
      "name": "John Doe",
      "address1": "123 Main Street",
      "address2": "Apt 4B",
      "city": "New York",
      "stateCode": "NY",
      "zip": "10001",
      "countryCode": "US"
    }
  }'
```

**Response:**
```json
{
  "orderId": "order_abc123xyz",
  "payment": {
    "chain": "solana",
    "token": "USDC",
    "address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": "92.19",
    "reference": "FortheCult_order_abc123xyz",
    "qrCode": "data:image/png;base64,iVBOR..."
  },
  "expiresAt": "2026-02-10T12:15:00Z",
  "statusUrl": "/api/orders/order_abc123xyz/status",
  "_actions": {
    "next": "Send 92.19 USDC to the payment address within 15 minutes",
    "cancel": "/api/orders/order_abc123xyz/cancel",
    "status": "/api/orders/order_abc123xyz/status"
  }
}
```

## Step 7: Check Order Status

```bash
curl https://forthecult.store/api/orders/order_abc123xyz/status
```

**Response (Awaiting Payment):**
```json
{
  "orderId": "order_abc123xyz",
  "status": "awaiting_payment",
  "paidAt": null,
  "_actions": {
    "next": "Complete payment to proceed",
    "cancel": "/api/orders/order_abc123xyz/cancel",
    "details": "/api/orders/order_abc123xyz"
  }
}
```

**Response (After Payment):**
```json
{
  "orderId": "order_abc123xyz",
  "status": "paid",
  "paidAt": "2026-02-10T12:08:30Z",
  "_actions": {
    "next": "Your order is being processed and will ship soon",
    "details": "/api/orders/order_abc123xyz"
  }
}
```

## Step 8: Get Full Order Details

```bash
curl https://forthecult.store/api/orders/order_abc123xyz
```

**Response:**
```json
{
  "orderId": "order_abc123xyz",
  "status": "shipped",
  "createdAt": "2026-02-10T12:00:00Z",
  "paidAt": "2026-02-10T12:08:30Z",
  "shippedAt": "2026-02-11T09:30:00Z",
  "email": "customer@example.com",
  "items": [
    {
      "productId": "prod_black_hoodie_001",
      "name": "Premium Black Hoodie",
      "variant": "Black / M",
      "quantity": 1,
      "price": 79.99,
      "imageUrl": "https://forthecult.store/images/black-hoodie.jpg"
    }
  ],
  "tracking": {
    "number": "9400111899562123456789",
    "carrier": "USPS",
    "url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899562123456789",
    "estimatedDelivery": "2026-02-14T17:00:00Z"
  },
  "totals": {
    "subtotal": 79.99,
    "shipping": 5.00,
    "total": 84.99
  },
  "payment": {
    "chain": "solana",
    "token": "USDC",
    "amount": "84.99",
    "txHash": "5wHu5XF4v5pKnfL9ZqYbX2z1A3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0",
    "confirmedAt": "2026-02-10T12:08:30Z"
  },
  "_actions": {
    "next": "Track your shipment using the tracking number",
    "help": "Contact support: weare@forthecult.store"
  }
}
```

---

## Complete JavaScript Example

```javascript
const API_BASE = 'https://forthecult.store/api';

async function completeShoppingFlow() {
  try {
    // 1. Health check
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    console.log('API Status:', health.status);

    // 2. Search for products
    const searchResults = await fetch(
      `${API_BASE}/products/search?q=black+hoodie&limit=5`
    ).then(r => r.json());

    const product = searchResults.products[0];
    console.log('Found product:', product.name);

    // 3. Get product details
    const productDetails = await fetch(
      `${API_BASE}/products/${product.slug}`
    ).then(r => r.json());

    const variant = productDetails.variants.find(v => v.inStock);
    console.log('Selected variant:', variant.name);

    // 4. Get payment chains
    const chains = await fetch(`${API_BASE}/chains`).then(r => r.json());
    console.log('Available chains:', chains.chains.map(c => c.name));

    // 5. Create order — productId must be product.id from search/details
    const order = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        email: 'customer@example.com',
        payment: { chain: 'solana', token: 'USDC' },
        shipping: {
          name: 'John Doe',
          address1: '123 Main St',
          city: 'New York',
          stateCode: 'NY',
          zip: '10001',
          countryCode: 'US'
        }
      })
    }).then(r => r.json());

    console.log('Order created:', order.orderId);
    console.log('Send', order.payment.amount, order.payment.token);
    console.log('To:', order.payment.address);

    // 6. Poll for payment confirmation
    const pollInterval = setInterval(async () => {
      const status = await fetch(
        `${API_BASE}/orders/${order.orderId}/status`
      ).then(r => r.json());

      console.log('Order status:', status.status);

      if (status.status === 'paid') {
        clearInterval(pollInterval);
        console.log('Payment confirmed at:', status.paidAt);

        // Get full order details
        const fullOrder = await fetch(
          `${API_BASE}/orders/${order.orderId}`
        ).then(r => r.json());
        console.log('Full order:', fullOrder);
      }
    }, 5000);

  } catch (error) {
    console.error('Error:', error);
  }
}

completeShoppingFlow();
```

---

## Error Handling

The API returns structured errors with helpful suggestions:

```json
{
  "error": {
    "code": "PRODUCT_OUT_OF_STOCK",
    "message": "The selected variant is out of stock",
    "details": {
      "productId": "<id from API>",
      "variantId": "<variant id from API>",
      "availableVariants": ["var_hoodie_s_black", "var_hoodie_m_black", "var_hoodie_l_black"]
    },
    "suggestions": [
      "Try a different size",
      "Check /api/products/premium-black-hoodie for available variants"
    ],
    "requestId": "req_xyz789"
  }
}
```

---

## Next Steps

- Learn about [Multi-Chain Payments](./multi-chain-payments.md)
- See [Order Tracking](./order-tracking.md) examples
- Read the [AI Agent Guide](../guides/ai-agents.md) for building shopping assistants
