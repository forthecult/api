/**
 * For the Cult API - JavaScript/TypeScript Example
 * Works in Node.js 18+ and modern browsers.
 *
 * No dependencies required -- uses native fetch.
 *
 * Usage:
 *   node javascript_example.js
 */

const BASE_URL = 'https://forthecult.store/api';

/**
 * Simple API client for For the Cult.
 */
class CultAPI {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get API capabilities (call this first).
   */
  async getCapabilities() {
    const response = await fetch(`${this.baseUrl}/agent/capabilities`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Search for products using natural language.
   */
  async searchProducts(query, options = {}) {
    const params = new URLSearchParams({
      q: query,
      limit: options.limit || 20,
      inStock: options.inStock !== false ? 'true' : 'false'
    });

    if (options.category) params.set('category', options.category);
    if (options.priceMin) params.set('priceMin', options.priceMin);
    if (options.priceMax) params.set('priceMax', options.priceMax);
    if (options.offset) params.set('offset', options.offset);

    const response = await fetch(
      `${this.baseUrl}/products/search?${params}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Search failed');
    }

    return response.json();
  }

  /**
   * Get product details by slug.
   */
  async getProduct(slug) {
    const response = await fetch(`${this.baseUrl}/products/${slug}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Product '${slug}' not found`);
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get all categories.
   */
  async getCategories() {
    const response = await fetch(`${this.baseUrl}/categories`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Get featured products.
   */
  async getFeatured() {
    const response = await fetch(`${this.baseUrl}/products/featured`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Get supported payment chains and tokens.
   */
  async getChains() {
    const response = await fetch(`${this.baseUrl}/chains`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  /**
   * Create order with crypto payment.
   */
  async createOrder(orderData) {
    const response = await fetch(`${this.baseUrl}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Order creation failed');
    }

    return response.json();
  }

  /**
   * Get order status.
   */
  async getOrderStatus(orderId) {
    const response = await fetch(
      `${this.baseUrl}/orders/${orderId}/status`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Order '${orderId}' not found`);
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get full order details.
   */
  async getOrder(orderId) {
    const response = await fetch(`${this.baseUrl}/orders/${orderId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Order '${orderId}' not found`);
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Wait for payment (poll order status).
   * @param {string} orderId - The order ID to track.
   * @param {number} timeoutMs - Max time to wait (default: 10 minutes).
   * @returns {Promise<{success: boolean, status: object}>}
   */
  async waitForPayment(orderId, timeoutMs = 600000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getOrderStatus(orderId);

      if (status.status === 'paid') {
        return { success: true, status };
      }

      if (status.status === 'expired' || status.status === 'cancelled') {
        return { success: false, status };
      }

      // Wait 10 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    return { success: false, status: null, timeout: true };
  }
}

// ============================================
// Example Usage
// ============================================

async function exampleSearch() {
  console.log('=== Searching for Bitcoin tees ===\n');

  const api = new CultAPI();

  const results = await api.searchProducts('cotton fleece', {
    category: 'mens-tees',
    priceMax: 50,
    limit: 5
  });

  console.log(`Found ${results.total} products:\n`);

  results.products.forEach(product => {
    console.log(`- ${product.name}`);
    console.log(`  $${product.price.usd}`);
    console.log(`  In stock: ${product.inStock}`);
    console.log(`  Slug: ${product.slug}\n`);
  });

  return results.products[0];
}

async function exampleProductDetails(slug) {
  console.log(`\n=== Product Details: ${slug} ===\n`);

  const api = new CultAPI();
  const product = await api.getProduct(slug);

  console.log(`Name: ${product.name}`);
  console.log(`Description: ${(product.description || '').substring(0, 100)}...`);
  console.log(`Price: $${product.price.usd}`);
  console.log('\nVariants:');

  product.variants?.forEach(variant => {
    const stockStatus = variant.inStock ? 'In Stock' : 'Out of Stock';
    console.log(`  - ${variant.name} - $${variant.price || product.price.usd} (${stockStatus})`);
  });

  return product;
}

async function exampleCreateOrder() {
  console.log('\n=== Creating Order ===\n');

  const api = new CultAPI();

  const results = await api.searchProducts('dark chocolate', { limit: 1 });

  if (results.products.length === 0) {
    console.log('No products found');
    return null;
  }

  const product = results.products[0];
  console.log(`Selected: ${product.name} - $${product.price.usd}\n`);

  const details = await api.getProduct(product.slug);
  const variant = details.variants?.[0];

  const order = await api.createOrder({
    items: [{
      productId: product.id,
      variantId: variant?.id,
      quantity: 1
    }],
    chain: 'solana',
    token: 'USDC',
    email: 'user@example.com',
    shippingAddress: {
      name: 'John Doe',
      line1: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94102',
      country: 'US'
    }
    // Optional: Include wallet for token holder discount
    // walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
  });

  console.log(`Order created: ${order.orderId}`);
  console.log('\nPayment Details:');
  console.log(`  Chain: ${order.payment.chain}`);
  console.log(`  Token: ${order.payment.token}`);
  console.log(`  Amount: ${order.payment.amount} ${order.payment.token}`);
  console.log(`  Address: ${order.payment.address}`);
  console.log(`\nExpires: ${order.expiresAt}`);

  if (order.discount) {
    console.log(`\nDiscount applied: ${order.discount.percentage}% off (${order.discount.tier} tier)`);
  }

  return order;
}

async function exampleCategories() {
  console.log('\n=== Categories ===\n');

  const api = new CultAPI();
  const { categories } = await api.getCategories();

  categories.forEach(cat => {
    console.log(`${cat.name} (${cat.productCount} products)`);
    cat.subcategories?.forEach(sub => {
      console.log(`  - ${sub.name} (${sub.productCount} products)`);
    });
  });
}

// ============================================
// Run Examples
// ============================================

async function runExamples() {
  console.log('For the Cult API - JavaScript Examples\n');
  console.log('='.repeat(50) + '\n');

  try {
    const firstProduct = await exampleSearch();

    if (firstProduct) {
      await exampleProductDetails(firstProduct.slug);
      const order = await exampleCreateOrder();

      if (order) {
        console.log('\n[In production, customer would send payment now]');
        console.log('[Agent would poll order status until \'paid\']');
      }
    }

    await exampleCategories();

    console.log('\n' + '='.repeat(50));
    console.log('Examples completed!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CultAPI };
}

// Run examples if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runExamples();
}
