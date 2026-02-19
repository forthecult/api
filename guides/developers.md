# Developer Guide

> **Complete guide to integrating For the Cult API into your application.**

---

## Getting Started

### Base URL

```
Production: https://forthecult.store/api
```

### No Authentication Required

All public endpoints are open -- no API key needed for browsing or checkout.

### Sign in with Moltbook (optional)

For endpoints that should accept **AI agent identity** (e.g. agent-specific features, karma-gated actions), the API supports [Sign in with Moltbook](https://moltbook.com/developers.md).

**Server environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `MOLTBOOK_APP_KEY` | Yes (for Moltbook auth) | **Set this to your app’s API key** from [Moltbook Developer Dashboard](https://moltbook.com/developers/dashboard). The key starts with `moltdev_`. Create an app there, copy the key, and put it in your server `.env` or host environment (do not commit the key). Example in `.env`: `MOLTBOOK_APP_KEY=moltdev_xxxx...` |
| `MOLTBOOK_AUDIENCE` | No (recommended) | Your service domain (e.g. `forthecult.store`) so tokens are restricted to your app. |
| `NEXT_PUBLIC_AGENT_APP_URL` | No | Agent-facing base URL (e.g. `https://ai.forthecult.store`). When set, capabilities and the for-agents page use this for all agent links so agents can use a dedicated subdomain. |

**Flow:** The agent sends header `X-Moltbook-Identity` with a temporary identity token. The server verifies it with `POST https://moltbook.com/api/v1/agents/verify-identity` (using `X-Moltbook-App-Key` and optional `audience`). If valid, the route receives the verified agent profile (`id`, `name`, `karma`, `owner.x_handle`, etc.). Invalid or expired tokens return `401` with `error` codes such as `identity_token_expired`, `invalid_token`, or `invalid_app_key`.

**Example (Next.js route):** Extract token, verify, then use the agent in your handler:

```ts
import { getMoltbookAgentFromRequest } from "~/lib/moltbook-auth";

export async function GET(request: NextRequest) {
  const result = await getMoltbookAgentFromRequest(request);
  if (result.error) return result.error;
  const agent = result.agent; // id, name, karma, owner, etc.
  return NextResponse.json({ agent });
}
```

**Example endpoint:** `GET /api/agent/me` returns the current verified Moltbook agent when `X-Moltbook-Identity` is present and valid.

### CORS (AI agents, browser clients)

Public API routes (e.g. shipping, checkout, products) send CORS headers so AI agents and browser clients on other origins can call the API directly with minimal friction. You can also call from a backend (Node, Python, curl, Postman); CORS does not affect server-to-server or CLI requests.

### Rate Limits

- **100 requests/minute** per IP address
- **Burst:** Up to 20 requests/second

---

## Installation

### Option 1: Direct HTTP (Recommended)

No installation needed -- use `fetch` (browser/Node.js 18+) or any HTTP client:

```javascript
const response = await fetch('https://forthecult.store/api/products/search?q=coffee');
const data = await response.json();
```

### Option 2: Python

```python
import requests

response = requests.get('https://forthecult.store/api/products/search', params={'q': 'coffee'})
data = response.json()
```

---

## Core Concepts

### 1. Products

Products have:
- **Unique slugs** for URLs (e.g., `colombian-dark-roast-coffee`)
- **Variants** for size/color options
- **Multi-currency pricing** (USD + crypto)
- **Stock tracking** per variant

### 2. Categories

Hierarchical structure:
```
Mens
  - T-Shirts
  - Hoodies
Womens
  - T-Shirts
Books
  - Privacy
  - Fiction
Coffee
Accessories
```

### 3. Orders

Stateless checkout:
1. Create order -> Get payment address
2. Customer sends crypto to the address
3. System detects payment on-chain -> Fulfills order
4. No login or account required

### 4. Payment Chains

Multi-chain support:
- **Solana** (SOL, USDC, USDT, CULT)
- **Ethereum** (ETH, USDC, USDT)
- **Base** (ETH, USDC)
- **Bitcoin** (BTC)
- **Dogecoin** (DOGE)
- **Monero** (XMR)

---

## Quick Integration

### Step 1: Search Products

```javascript
// Semantic search -- natural language queries work
const response = await fetch(
  'https://forthecult.store/api/products/search?q=smart+home'
);
const { products, total } = await response.json();

// With filters
const params = new URLSearchParams({
  q: 'hoodie',
  category: 'mens',
  priceMax: '100',
  inStock: 'true',
  limit: '10'
});

const filtered = await fetch(
  `https://forthecult.store/api/products/search?${params}`
);
```

### Step 2: Get Product Details

```javascript
const response = await fetch(
  'https://forthecult.store/api/products/mens-alpaca-socks'
);
const product = await response.json();

console.log(product.name);
console.log(product.price.usd);
console.log(product.variants); // Size/color options
```

### Step 3: Create Order

```javascript
const response = await fetch('https://forthecult.store/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productId: productIdFromSearch, quantity: 1 }],
    email: 'user@example.com',
    payment: { chain: 'solana', token: 'USDC' },
    shipping: {
      name: 'Hal Finney',
      address1: '123 Main St',
      city: 'San Francisco',
      stateCode: 'CA',
      zip: '94102',
      countryCode: 'US'
    }
  })
});

const order = await response.json();

// Show payment info to customer
console.log('Send', order.payment.amount, order.payment.token);
console.log('To address:', order.payment.address);
console.log('Expires at:', order.expiresAt);
```

### Step 4: Check Order Status

```javascript
async function waitForPayment(orderId) {
  while (true) {
    const response = await fetch(
      `https://forthecult.store/api/orders/${orderId}/status`
    );
    const status = await response.json();
    
    if (status.status === 'paid') {
      return true; // Payment confirmed!
    }
    
    if (status.status === 'expired' || status.status === 'cancelled') {
      return false; // Payment window expired or cancelled
    }
    
    // Wait 10 seconds before checking again
    await new Promise(r => setTimeout(r, 10000));
  }
}
```

---

## Advanced Features

### Token Holder Discounts

Include wallet address to verify CULT token holdings:

```javascript
const response = await fetch('https://forthecult.store/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: [{ productId: productIdFromSearchOrDetail, quantity: 1 }],
    email: 'user@example.com',
    payment: { chain: 'solana', token: 'USDC' },
    shipping: {
      name: 'Token Holder',
      address1: '456 Crypto St',
      city: 'Miami',
      stateCode: 'FL',
      zip: '33101',
      countryCode: 'US'
    }
  })
});

const order = await response.json();

if (order.discount) {
  console.log(`${order.discount.tier} holder: ${order.discount.percentage}% off!`);
  console.log(`Saved: $${order.discount.savedAmount}`);
}
```

### Pagination

```javascript
let offset = 0;
const limit = 20;

const response = await fetch(
  `https://forthecult.store/api/products/search?q=tee&limit=${limit}&offset=${offset}`
);
const data = await response.json();

console.log(`Showing ${data.products.length} of ${data.total}`);

if (data.pagination?.hasMore) {
  offset += limit;
  // Fetch next page with new offset
}
```

### Error Handling

```javascript
try {
  const response = await fetch(
    'https://forthecult.store/api/products/invalid-slug'
  );
  
  if (!response.ok) {
    const error = await response.json();
    
    // Structured error with suggestions
    console.error(error.error.code);        // "PRODUCT_NOT_FOUND"
    console.error(error.error.message);     // "Product not found"
    console.log(error.error.suggestions);   // ["Try searching...", "Browse categories..."]
    
    // Use suggestions to auto-recover
    if (error.error.suggestions?.[0]) {
      // Parse and retry with suggestion
    }
  }
  
} catch (err) {
  console.error('Network error:', err);
}
```

---

## Frontend Integration

### React Example

```tsx
import { useState, useEffect } from 'react';

const API_BASE = 'https://forthecult.store/api';

function ProductSearch() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const searchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/products/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setProducts(data.products);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />
      <button onClick={searchProducts}>Search</button>
      
      {loading && <p>Loading...</p>}
      
      <ul>
        {products.map(product => (
          <li key={product.id}>
            <h3>{product.name}</h3>
            <p>${product.price.usd}</p>
            <a href={`/products/${product.slug}`}>View Details</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Vue Example

```vue
<template>
  <div>
    <input v-model="query" @keyup.enter="search" placeholder="Search..." />
    <button @click="search">Search</button>
    
    <div v-if="loading">Loading...</div>
    
    <div v-for="product in products" :key="product.id">
      <h3>{{ product.name }}</h3>
      <p>${{ product.price.usd }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const API_BASE = 'https://forthecult.store/api';
const query = ref('');
const products = ref([]);
const loading = ref(false);

const search = async () => {
  loading.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/products/search?q=${encodeURIComponent(query.value)}`
    );
    const data = await response.json();
    products.value = data.products;
  } finally {
    loading.value = false;
  }
};
</script>
```

---

## Backend Integration

### Node.js/Express

```javascript
const express = require('express');
const app = express();
app.use(express.json());

const API_BASE = 'https://forthecult.store/api';

app.post('/api/create-order', async (req, res) => {
  try {
    const { productId, variantId, email, shippingAddress } = req.body;
    
    const response = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ productId, variantId, quantity: 1 }],
        chain: 'solana',
        token: 'USDC',
        email,
        shippingAddress
      })
    });
    
    const order = await response.json();
    res.json(order);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### Python/Flask

```python
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

API_BASE = 'https://forthecult.store/api'

@app.post('/api/create-order')
def create_order():
    data = request.json
    
    response = requests.post(
        f'{API_BASE}/checkout',
        json={
            'items': [{'productId': data['product_id'], 'quantity': 1}],
            'chain': data.get('chain', 'solana'),
            'token': data.get('token', 'USDC'),
            'email': data['email'],
            'shippingAddress': data['shipping_address']
        }
    )
    
    return jsonify(response.json())

if __name__ == '__main__':
    app.run(port=3000)
```

---

## Testing

### Postman Collection

Import our Postman collection for easy testing:

**[Download postman_collection.json](../postman_collection.json)**

### cURL Examples

```bash
# Health check
curl https://forthecult.store/api/health

# Search products
curl "https://forthecult.store/api/products/search?q=smart+home"

# Get product details
curl "https://forthecult.store/api/products/medium-roast-coffee"

# Get supported chains
curl https://forthecult.store/api/chains

# Create order (use product id from search or product detail)
curl -X POST https://forthecult.store/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": "<id from /products/search or /products/{slug}>", "quantity": 1}],
    "email": "test@example.com",
    "payment": { "chain": "solana", "token": "USDC" },
    "shipping": {
      "name": "Test User",
      "address1": "123 Test St",
      "city": "Test City",
      "stateCode": "CA",
      "zip": "12345",
      "countryCode": "US"
    }
  }'

# Check order status
curl https://forthecult.store/api/orders/order_abc123/status
```

---

## Best Practices

### 1. Cache Responses

Cache static data (categories, chains):

```javascript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

async function getCategoriesWithCache() {
  const cached = cache.get('categories');
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const response = await fetch('https://forthecult.store/api/categories');
  const data = await response.json();
  
  cache.set('categories', { data, timestamp: Date.now() });
  return data;
}
```

### 2. Handle Network Errors with Retry

```javascript
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (response.status === 429) {
        // Rate limited -- wait and retry
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}`);
      
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

### 3. Validate Input

```javascript
function validateShippingAddress(address) {
  const required = ['name', 'line1', 'city', 'country', 'postalCode'];
  
  for (const field of required) {
    if (!address[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  if (address.country.length !== 2) {
    throw new Error('Country must be 2-letter ISO code (e.g., US)');
  }
  
  return true;
}
```

### 4. Monitor Order Status

```javascript
class OrderMonitor {
  constructor(orderId) {
    this.orderId = orderId;
    this.listeners = [];
  }
  
  on(event, callback) {
    this.listeners.push({ event, callback });
  }
  
  async start() {
    while (true) {
      const status = await this.checkStatus();
      
      this.notify(status.status, status);
      
      if (['delivered', 'expired', 'cancelled'].includes(status.status)) {
        break;
      }
      
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  
  async checkStatus() {
    const response = await fetch(
      `https://forthecult.store/api/orders/${this.orderId}/status`
    );
    return response.json();
  }
  
  notify(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }
}

// Usage
const monitor = new OrderMonitor('order_123');
monitor.on('paid', () => console.log('Payment confirmed!'));
monitor.on('shipped', (status) => console.log('Shipped!', status.tracking));
monitor.on('expired', () => console.log('Payment expired'));
monitor.start();
```

---

## Support

- **Email:** dev@forthecult.store
- **GitHub Issues:** https://github.com/forthecult/api/issues

---

## Next Steps

1. Review [AI Agents Guide](./ai-agents.md) if building with LLMs
2. Check [code examples](../examples/)
3. Test with [Postman collection](../postman_collection.json)
4. Integrate search and checkout
5. Go live and monitor
