"""
For the Cult API - Python Example
Complete purchase flow from search to payment tracking.

Requirements:
    pip install requests

Usage:
    python python_example.py
"""

import requests
import time
from typing import Optional, Dict, List

BASE_URL = "https://forthecult.store/api"


class CultAPI:
    """Simple Python client for the For the Cult API."""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()

    def get_capabilities(self) -> Dict:
        """Get API capabilities -- call this first to understand what you can do."""
        response = self.session.get(f"{self.base_url}/agent/capabilities")
        response.raise_for_status()
        return response.json()

    def search_products(
        self,
        query: str,
        category: Optional[str] = None,
        price_min: Optional[float] = None,
        price_max: Optional[float] = None,
        in_stock: bool = True,
        limit: int = 20,
    ) -> Dict:
        """Search for products using natural language."""
        params = {
            "q": query,
            "limit": limit,
            "inStock": str(in_stock).lower(),
        }

        if category:
            params["category"] = category
        if price_min is not None:
            params["priceMin"] = price_min
        if price_max is not None:
            params["priceMax"] = price_max

        response = self.session.get(
            f"{self.base_url}/products/search", params=params
        )
        response.raise_for_status()
        return response.json()

    def get_product(self, slug: str) -> Dict:
        """Get product details by slug."""
        response = self.session.get(f"{self.base_url}/products/{slug}")
        response.raise_for_status()
        return response.json()

    def get_categories(self) -> Dict:
        """Get all categories."""
        response = self.session.get(f"{self.base_url}/categories")
        response.raise_for_status()
        return response.json()

    def get_chains(self) -> Dict:
        """Get supported payment chains and tokens."""
        response = self.session.get(f"{self.base_url}/chains")
        response.raise_for_status()
        return response.json()

    def create_order(
        self,
        items: List[Dict],
        chain: str,
        token: str,
        email: str,
        shipping_address: Dict,
        wallet_address: Optional[str] = None,
    ) -> Dict:
        """Create order with crypto payment."""
        payload = {
            "items": items,
            "chain": chain,
            "token": token,
            "email": email,
            "shippingAddress": shipping_address,
        }

        if wallet_address:
            payload["walletAddress"] = wallet_address

        response = self.session.post(f"{self.base_url}/checkout", json=payload)
        response.raise_for_status()
        return response.json()

    def get_order_status(self, order_id: str) -> Dict:
        """Check order payment/shipping status."""
        response = self.session.get(
            f"{self.base_url}/orders/{order_id}/status"
        )
        response.raise_for_status()
        return response.json()

    def get_order(self, order_id: str) -> Dict:
        """Get full order details."""
        response = self.session.get(f"{self.base_url}/orders/{order_id}")
        response.raise_for_status()
        return response.json()


# ============================================
# Examples
# ============================================


def example_search():
    """Example: Search for products."""
    print("=== Searching for Bitcoin tees ===\n")

    api = CultAPI()
    results = api.search_products(
        query="alpaca socks", category="mens-tees", price_max=50
    )

    print(f"Found {results['total']} products:\n")

    for product in results["products"][:5]:
        print(f"- {product['name']}")
        print(f"  ${product['price']['usd']}")
        print(f"  In stock: {product['inStock']}")
        print(f"  Slug: {product['slug']}\n")

    return results["products"][0] if results["products"] else None


def example_product_details(slug: str):
    """Example: Get product details."""
    print(f"\n=== Product Details: {slug} ===\n")

    api = CultAPI()
    product = api.get_product(slug)

    print(f"Name: {product['name']}")
    print(f"Description: {product.get('description', 'N/A')[:100]}...")
    print(f"Price: ${product['price']['usd']}")
    print(f"\nVariants:")

    for variant in product.get("variants", []):
        stock_status = "In Stock" if variant["inStock"] else "Out of Stock"
        print(
            f"  - {variant['name']} - "
            f"${variant.get('price', product['price']['usd'])} "
            f"({stock_status})"
        )

    return product


def example_create_order():
    """Example: Complete purchase flow."""
    print("\n=== Creating Order ===\n")

    api = CultAPI()

    # 1. Search for product
    results = api.search_products("coffee beans", limit=1)
    if not results["products"]:
        print("No products found")
        return None

    product = results["products"][0]
    print(f"Selected: {product['name']} - ${product['price']['usd']}\n")

    # 2. Get product details for variants
    details = api.get_product(product["slug"])
    variant = details.get("variants", [{}])[0] if details.get("variants") else None

    # 3. Create order
    items = [
        {
            "productId": product["id"],
            "variantId": variant["id"] if variant else None,
            "quantity": 1,
        }
    ]

    order = api.create_order(
        items=items,
        chain="solana",
        token="USDC",
        email="user@example.com",
        shipping_address={
            "name": "John Doe",
            "line1": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "postalCode": "94102",
            "country": "US",
        },
    )

    print(f"Order created: {order['orderId']}")
    print(f"\nPayment Details:")
    print(f"  Chain: {order['payment']['chain']}")
    print(f"  Token: {order['payment']['token']}")
    print(f"  Amount: {order['payment']['amount']} {order['payment']['token']}")
    print(f"  Address: {order['payment']['address']}")
    print(f"\nExpires: {order['expiresAt']}")

    if order.get("discount"):
        print(
            f"\nDiscount applied: {order['discount']['percentage']}% off "
            f"({order['discount']['tier']} tier)"
        )

    return order


def example_wait_for_payment(order_id: str, timeout: int = 600):
    """Example: Poll order status until paid."""
    print(f"\n=== Waiting for payment (order: {order_id}) ===\n")

    api = CultAPI()
    start_time = time.time()

    while time.time() - start_time < timeout:
        status = api.get_order_status(order_id)

        print(f"Status: {status['status']}")
        print(f"Action: {status.get('_actions', {}).get('next', 'N/A')}\n")

        if status["status"] == "paid":
            print("Payment confirmed!")
            print(f"Paid at: {status['paidAt']}")
            return True
        elif status["status"] in ["expired", "cancelled"]:
            print(f"Order {status['status']}")
            return False

        time.sleep(10)

    print("Timeout waiting for payment")
    return False


def example_track_order(order_id: str):
    """Example: Get order tracking info."""
    print(f"\n=== Order Tracking: {order_id} ===\n")

    api = CultAPI()
    order = api.get_order(order_id)

    print(f"Status: {order['status']}")
    print(f"Created: {order['createdAt']}")

    if order.get("paidAt"):
        print(f"Paid: {order['paidAt']}")

    if order.get("tracking"):
        tracking = order["tracking"]
        print(f"\nTracking:")
        print(f"  Carrier: {tracking['carrier']}")
        print(f"  Number: {tracking['number']}")
        print(f"  URL: {tracking['url']}")

    print(f"\nItems:")
    for item in order.get("items", []):
        print(f"  - {item['name']} x{item['quantity']} @ ${item['price']}")

    print(f"\nTotals:")
    totals = order.get("totals", {})
    print(f"  Subtotal: ${totals.get('subtotal', 0)}")
    print(f"  Shipping: ${totals.get('shipping', 0)}")
    print(f"  Total: ${totals.get('total', 0)}")


if __name__ == "__main__":
    print("For the Cult API - Python Examples\n")
    print("=" * 50 + "\n")

    # Example 1: Search
    first_product = example_search()

    if first_product:
        # Example 2: Product details
        example_product_details(first_product["slug"])

        # Example 3: Create order
        order = example_create_order()

        if order:
            # Example 4: Wait for payment (in production)
            print("\n[In production, customer would send payment now]")
            print("[Agent would poll order status until 'paid']")

            # Example 5: Track order (after payment)
            # example_track_order(order['orderId'])

    print("\n" + "=" * 50)
    print("Examples completed!")
