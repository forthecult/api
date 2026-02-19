# AI Agents Guide

> **How to integrate For the Cult API with AI assistants and autonomous agents.**

---

## Quick Start for AI Agents

### Step 1: Understand Capabilities

**Always call this endpoint first:**

```bash
GET /api/agent/capabilities
```

This returns what the API can do, limitations, and supported payment methods in natural language.

### Step 2: Common Workflows

#### Workflow A: Help User Find Products

```
User: "I need a warm hoodie"

Agent Actions:
1. GET /api/products/search?q=warm+hoodie
2. Present top 3 results with prices
3. Ask user which one they like
4. Call GET /api/products/{slug} for chosen product
5. Show details, variants, availability
```

#### Workflow B: Complete Purchase

```
User: "I want to buy the dark roasted coffee"

Agent Actions:
1. Get product id: use the "id" from search (GET /api/products/search?q=...) or product detail (GET /api/products/{slug}). Never use placeholder or example IDs.
2. Confirm product and quantity
3. Ask for: email, shipping address, preferred payment (e.g. Solana USDC)
4. POST /api/checkout with: items: [{ productId: "<id from API>", quantity }], email, payment: { chain, token }, shipping: { name, address1, city, stateCode, zip, countryCode }
5. Present payment address and amount; poll GET /api/orders/{orderId}/status until paid
6. Confirm order and provide tracking info
```

#### Workflow C: Check Order Status

```
User: "What's the status of my order?"

Agent Actions:
1. Ask for order ID
2. GET /api/orders/{orderId}/status
3. Interpret status and explain in natural language
4. Provide tracking link if shipped
```

---

## Integration Examples

### Claude (Anthropic)

Claude can use the For the Cult API through its tool use feature.

**Tool Definitions:**

```json
[
  {
    "name": "search_forthecult_products",
    "description": "Search for lifestyle products on For the Cult. Supports natural language queries. Returns products with prices in USD and crypto.",
    "input_schema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query (e.g., 'warm hoodie', 'alpaca socks under $50')"
        },
        "category": {
          "type": "string",
          "description": "Filter by category slug (optional)"
        },
        "maxPrice": {
          "type": "number",
          "description": "Maximum price in USD (optional)"
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "get_forthecult_product",
    "description": "Get detailed product information including variants, sizes, and availability.",
    "input_schema": {
      "type": "object",
      "properties": {
        "slug": {
          "type": "string",
          "description": "Product slug from search results"
        }
      },
      "required": ["slug"]
    }
  },
  {
    "name": "create_forthecult_order",
    "description": "Create an order with crypto payment. Use productId from search or product-detail API (the 'id' field). Returns payment address and amount.",
    "input_schema": {
      "type": "object",
      "properties": {
        "productId": { "type": "string", "description": "Product id from GET /api/products/search or GET /api/products/{slug} (required)" },
        "variantId": { "type": "string" },
        "quantity": { "type": "integer", "minimum": 1 },
        "email": { "type": "string" },
        "shipping": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "address1": { "type": "string" },
            "address2": { "type": "string" },
            "city": { "type": "string" },
            "stateCode": { "type": "string" },
            "zip": { "type": "string" },
            "countryCode": { "type": "string" }
          },
          "required": ["name", "address1", "city", "stateCode", "zip", "countryCode"]
        },
        "payment": {
          "type": "object",
          "properties": { "chain": { "type": "string" }, "token": { "type": "string" } },
          "required": ["chain", "token"]
        }
      },
      "required": ["productId", "quantity", "email", "payment", "shipping"]
    }
  },
  {
    "name": "check_forthecult_order",
    "description": "Check the payment and shipping status of an order.",
    "input_schema": {
      "type": "object",
      "properties": {
        "orderId": { "type": "string" }
      },
      "required": ["orderId"]
    }
  }
]
```

**Tool Implementation:**

```python
import anthropic
import requests

API_BASE = "https://forthecult.store/api"

def search_forthecult_products(query, category=None, max_price=None):
    params = {"q": query}
    if category:
        params["category"] = category
    if max_price:
        params["priceMax"] = max_price
    
    response = requests.get(f"{API_BASE}/products/search", params=params)
    return response.json()

def get_forthecult_product(slug):
    response = requests.get(f"{API_BASE}/products/{slug}")
    return response.json()

def create_forthecult_order(product_id, quantity, chain, token, email, shipping, variant_id=None):
    """product_id must be the id from search or get_forthecult_product(slug)."""
    payload = {
        "items": [{"productId": product_id, "quantity": quantity}],
        "email": email,
        "payment": {"chain": chain, "token": token},
        "shipping": shipping  # { name, address1, city, stateCode, zip, countryCode }
    }
    if variant_id:
        payload["items"][0]["variantId"] = variant_id
    response = requests.post(f"{API_BASE}/checkout", json=payload)
    return response.json()

def check_forthecult_order(order_id):
    response = requests.get(f"{API_BASE}/orders/{order_id}/status")
    return response.json()

# Use with Claude
client = anthropic.Anthropic(api_key="your-api-key")

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    tools=[
        {
            "name": "search_forthecult_products",
            "description": "Search for lifestyle products on For the Cult",
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "category": {"type": "string"},
                    "maxPrice": {"type": "number"}
                },
                "required": ["query"]
            }
        }
    ],
    messages=[{
        "role": "user",
        "content": "Find me a warm hoodie under $100"
    }]
)
```

### ChatGPT (OpenAI)

Use as a GPT Action or via function calling.

**GPT Action Schema:**

```yaml
openapi: 3.0.0
info:
  title: For the Cult API
  version: 1.0.0
servers:
  - url: https://forthecult.store
paths:
  /api/products/search:
    get:
      operationId: searchProducts
      summary: Search for products
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Products found
```

**Function Calling (Python SDK):**

```python
from openai import OpenAI

client = OpenAI(api_key="your-api-key")

tools = [{
    "type": "function",
    "function": {
        "name": "search_products",
        "description": "Search For the Cult for lifestyle products. Supports natural language queries.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Product search query"
                },
                "category": {"type": "string"},
                "max_price": {"type": "number"}
            },
            "required": ["query"]
        }
    }
}]

response = client.chat.completions.create(
    model="gpt-4-turbo",
    messages=[
        {"role": "system", "content": "You help users shop on For the Cult, an eCommerce store with crypto payments."},
        {"role": "user", "content": "Find me a birthday present under $50"}
    ],
    tools=tools
)
```

### Custom Agents (LangChain)

**Tool Implementation:**

```python
from langchain.tools import BaseTool
from typing import Optional
import requests

API_BASE = "https://forthecult.store/api"

class ForTheCultSearchTool(BaseTool):
    name = "search_forthecult"
    description = "Search for lifestyle products on For the Cult store. Input: natural language search query."
    
    def _run(self, query: str, category: Optional[str] = None) -> str:
        params = {"q": query}
        if category:
            params["category"] = category
        
        response = requests.get(f"{API_BASE}/products/search", params=params)
        data = response.json()
        
        products = data.get("products", [])
        if not products:
            return "No products found."
        
        result = f"Found {len(products)} products:\n\n"
        for p in products[:5]:
            result += f"- {p['name']}: ${p['price']['usd']}\n"
            result += f"  Details: /api/products/{p['slug']}\n\n"
        
        return result

class ForTheCultProductTool(BaseTool):
    name = "get_forthecult_product"
    description = "Get detailed info about a specific product including variants and availability."
    
    def _run(self, slug: str) -> str:
        response = requests.get(f"{API_BASE}/products/{slug}")
        if response.status_code == 404:
            return f"Product '{slug}' not found."
        
        product = response.json()
        result = f"**{product['name']}** - ${product['price']['usd']}\n"
        result += f"{product.get('description', '')}\n\n"
        result += "Variants:\n"
        for v in product.get('variants', []):
            stock = "In Stock" if v['inStock'] else "Out of Stock"
            result += f"  - {v['name']}: ${v.get('price', product['price']['usd'])} ({stock})\n"
        return result

class ForTheCultCheckoutTool(BaseTool):
    name = "create_forthecult_order"
    description = "Create an order with crypto payment. Input: JSON string with productId, variantId, quantity, chain, token, email, shippingAddress."
    
    def _run(self, order_json: str) -> str:
        import json
        order_data = json.loads(order_json)
        response = requests.post(f"{API_BASE}/checkout", json=order_data)
        return json.dumps(response.json(), indent=2)

# Use in a LangChain agent
from langchain.agents import initialize_agent, AgentType
from langchain.llms import OpenAI

tools = [
    ForTheCultSearchTool(),
    ForTheCultProductTool(),
    ForTheCultCheckoutTool()
]

llm = OpenAI(temperature=0)

agent = initialize_agent(
    tools,
    llm,
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)

agent.run("Help me find a birthday present under $50")
```

### OpenClaw (Moltbook)

Full autonomous agent framework with advanced capabilities.

**[Complete OpenClaw Integration Guide →](./openclaw-integration.md)**

**Quick example:**

```python
from openclaw import Agent, Tool
import requests

API_BASE = "https://forthecult.store/api"

class ForTheCultSearchTool(Tool):
    name = "search_products"
    description = "Search For the Cult for products"
    
    def execute(self, query):
        response = requests.get(
            f"{API_BASE}/products/search",
            params={"q": query}
        )
        return response.json()

agent = Agent("CultShopper")
agent.add_tool(ForTheCultSearchTool())

result = agent.run("Find me an esim card")
```

---

## Building a Complete Shopping Agent

Here's a full Python agent that handles the complete shopping flow:

```python
import requests
import json
import time

class ShoppingAgent:
    """Complete AI shopping agent for For the Cult API"""
    
    def __init__(self, api_base="https://forthecult.store/api"):
        self.api_base = api_base
        self.capabilities = self._get_capabilities()
        self.conversation_history = []
    
    def _get_capabilities(self):
        """Learn what the API can do"""
        response = requests.get(f"{self.api_base}/agent/capabilities")
        return response.json()
    
    def search_products(self, query, filters=None):
        """Search using natural language (API supports semantic search)"""
        params = {"q": query}
        if filters:
            params.update(filters)
        
        response = requests.get(f"{self.api_base}/products/search", params=params)
        return response.json()
    
    def get_product_details(self, slug):
        """Get full product info including variants"""
        response = requests.get(f"{self.api_base}/products/{slug}")
        return response.json()
    
    def get_chains(self):
        """Get supported payment chains and tokens"""
        response = requests.get(f"{self.api_base}/chains")
        return response.json()
    
    def create_order(self, product_id, variant_id, email, shipping_address,
                     chain="solana", token="USDC", quantity=1, wallet_address=None):
        """Create order with crypto payment"""
        payload = {
            "items": [{
                "productId": product_id,
                "variantId": variant_id,
                "quantity": quantity
            }],
            "chain": chain,
            "token": token,
            "email": email,
            "shippingAddress": shipping_address
        }
        
        if wallet_address:
            payload["walletAddress"] = wallet_address
        
        response = requests.post(f"{self.api_base}/checkout", json=payload)
        return response.json()
    
    def check_order_status(self, order_id):
        """Check order payment and shipping status"""
        response = requests.get(f"{self.api_base}/orders/{order_id}/status")
        return response.json()
    
    def handle_user_message(self, message, user_context):
        """Main entry point: process user message and take action"""
        self.conversation_history.append({"role": "user", "content": message})
        
        intent = self._detect_intent(message)
        
        if intent == "search":
            return self._handle_search(message, user_context)
        elif intent == "checkout":
            return self._handle_checkout(message, user_context)
        elif intent == "order_status":
            return self._handle_order_status(message, user_context)
        else:
            return self._handle_general(message)
    
    def _detect_intent(self, message):
        """Simple intent detection (use NLP/LLM in production)"""
        message_lower = message.lower()
        
        if any(w in message_lower for w in ["search", "find", "looking for", "need", "want"]):
            return "search"
        elif any(w in message_lower for w in ["buy", "purchase", "checkout", "order it"]):
            return "checkout"
        elif any(w in message_lower for w in ["status", "track", "where is", "shipped"]):
            return "order_status"
        else:
            return "general"
    
    def _handle_search(self, message, user_context):
        """Handle product search queries"""
        results = self.search_products(message)
        
        if not results.get("products"):
            return {
                "message": f"No products found for '{message}'. Try browsing categories.",
                "action": "suggest_categories"
            }
        
        products_text = []
        for p in results["products"][:5]:
            products_text.append(f"- {p['name']} - ${p['price']['usd']}")
        
        return {
            "message": f"Found {len(results['products'])} products:\n" + "\n".join(products_text),
            "products": results["products"],
            "next_actions": ["View details", "Refine search", "Buy now"]
        }
    
    def _handle_checkout(self, message, user_context):
        """Handle checkout flow"""
        if "selected_product" not in user_context:
            return {
                "message": "Please select a product first. What would you like to buy?",
                "action": "needs_product_selection"
            }
        
        if "shippingAddress" not in user_context:
            return {
                "message": "I need your shipping address to continue.",
                "action": "needs_shipping_info",
                "required_fields": ["name", "line1", "city", "state", "postalCode", "country"]
            }
        
        product = user_context["selected_product"]
        variant = user_context.get("selected_variant")
        
        order = self.create_order(
            product_id=product["id"],
            variant_id=variant["id"] if variant else None,
            email=user_context["email"],
            shipping_address=user_context["shippingAddress"],
            chain=user_context.get("payment_chain", "solana"),
            token=user_context.get("payment_token", "USDC")
        )
        
        # Use action hints from the API response
        next_step = order.get("_actions", {}).get("next", "Complete payment to proceed.")
        
        return {
            "message": f"Order created! {next_step}",
            "order_id": order["orderId"],
            "payment_address": order["payment"]["address"],
            "payment_amount": f"{order['payment']['amount']} {order['payment']['token']}",
            "expires_at": order["expiresAt"],
            "action": "complete_payment"
        }
    
    def _handle_order_status(self, message, user_context):
        """Check order status"""
        if "order_id" not in user_context:
            return {
                "message": "Please provide your order ID.",
                "action": "needs_order_id"
            }
        
        status = self.check_order_status(user_context["order_id"])
        next_step = status.get("_actions", {}).get("next", "")
        
        status_messages = {
            "awaiting_payment": f"Waiting for payment. {next_step}",
            "paid": f"Payment confirmed! {next_step}",
            "processing": "Your order is being prepared for shipment.",
            "shipped": f"Your order has shipped! {next_step}",
            "delivered": "Your order has been delivered!",
            "cancelled": "This order was cancelled.",
            "expired": "This order expired due to non-payment."
        }
        
        return {
            "message": status_messages.get(status["status"], f"Status: {status['status']}"),
            "status": status["status"],
            "tracking": status.get("tracking")
        }
    
    def _handle_general(self, message):
        """Handle general queries"""
        return {
            "message": "I can help you search for products, place orders, and track shipments. What are you looking for?",
            "capabilities": self.capabilities.get("capabilities", [])
        }
    
    def handle_api_error(self, error_response):
        """Use structured errors and suggestions to recover"""
        error = error_response.get("error", {})
        suggestions = error.get("suggestions", [])
        
        message = f"Error: {error.get('message', 'Something went wrong')}"
        
        if suggestions:
            message += "\n\nSuggestions:"
            for i, suggestion in enumerate(suggestions, 1):
                message += f"\n{i}. {suggestion}"
        
        return {"error": True, "message": message, "suggestions": suggestions}


# Example usage
if __name__ == "__main__":
    agent = ShoppingAgent()
    
    user_context = {
        "email": "user@example.com",
        "payment_chain": "solana",
        "payment_token": "USDC"
    }
    
    # Search
    result = agent.handle_user_message("I need a warm black hoodie", user_context)
    print(result["message"])
    
    # Select product
    if result.get("products"):
        user_context["selected_product"] = result["products"][0]
        
        # Get details and select variant
        details = agent.get_product_details(result["products"][0]["slug"])
        in_stock_variants = [v for v in details.get("variants", []) if v.get("inStock")]
        if in_stock_variants:
            user_context["selected_variant"] = in_stock_variants[0]
        
        # Add shipping
        user_context["shippingAddress"] = {
            "name": "John Doe",
            "line1": "123 Main St",
            "city": "New York",
            "state": "NY",
            "postalCode": "10001",
            "country": "US"
        }
        
        # Checkout
        checkout = agent.handle_user_message("I want to buy this", user_context)
        print(checkout["message"])
```

---

## Best Practices

### 1. Always Check Capabilities First

```python
# Before any other calls
capabilities = requests.get(
    "https://forthecult.store/api/agent/capabilities"
).json()

# Know what you can do
supported_chains = capabilities['supportedNetworks']
limitations = capabilities['limitations']
```

### 2. Use Semantic Search

The API understands natural language -- don't over-engineer queries:

```bash
# Good -- natural language
GET /api/products/search?q=privacy+books+for+beginners

# Good -- specific
GET /api/products/search?q=water+filter

# Unnecessary -- API handles this internally
GET /api/products/search?q=privacy+OR+books+AND+beginners
```

### 3. Follow Action Hints

Responses include `_actions` fields telling agents what to do next:

```python
order = create_order(...)
next_step = order.get('_actions', {}).get('next', '')
# Present next_step to the user
```

### 4. Handle Errors with Auto-Recovery

Errors include suggestions agents can use to auto-recover:

```python
response = search_products("etherum tshirt")
if "error" in response:
    suggestions = response["error"].get("suggestions", [])
    if suggestions:
        # First suggestion often has the corrected query
        # e.g., "Did you mean 'ethereum tshirt'?"
        corrected_query = parse_suggestion(suggestions[0])
        response = search_products(corrected_query)
```

### 5. Explain Crypto Payments Clearly

```python
def explain_payment(payment_info):
    return f"""
To complete your order:

1. Open your {payment_info['chain'].title()} wallet
2. Send {payment_info['amount']} {payment_info['token']} to:
   {payment_info['address']}
3. Your order will be confirmed automatically (typically 1-2 minutes)
"""
```

### 6. Poll Order Status Responsibly

```python
import time

def wait_for_payment(order_id, timeout=600):
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        status = get_order_status(order_id)
        
        if status['status'] == 'paid':
            return True
        elif status['status'] in ['expired', 'cancelled']:
            return False
        
        print(f"Status: {status.get('_actions', {}).get('next', 'Waiting...')}")
        time.sleep(10)  # Check every 10 seconds
    
    return False  # Timeout
```

---

## Rate Limits

- **No authentication required** for public endpoints
- **Rate limit:** 100 requests/minute per IP
- **Burst:** Up to 20 requests/second

**Exceeding limits returns:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Try again in 60 seconds.",
    "retryAfter": 60
  }
}
```

**Best practice:** Implement exponential backoff

```python
import time

def api_call_with_retry(func, *args, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func(*args)
        except Exception as e:
            if "429" in str(e) and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                time.sleep(wait_time)
            else:
                raise
```

---

## Testing

### Mock Responses for Development

```python
import os

MOCK_PRODUCTS = {
    "products": [
        {
            "id": "prod_1",
            "name": "Coffee - Medium Roast",
            "slug": "medium-roast-coffee",
            "price": {"usd": 19.99},
            "inStock": True
        }
    ],
    "total": 1
}

def mock_search(query):
    return MOCK_PRODUCTS

# Use mocks in development
if os.getenv("ENV") == "development":
    search_products = mock_search
else:
    search_products = real_api_search
```

---

## Support

- **Email:** dev@forthecult.store
- **GitHub Issues:** https://github.com/forthecult/api/issues

---

## Next Steps

1. Review [code examples](../examples/)
2. Test with `/api/agent/capabilities`
3. Integrate search and checkout
4. Read the [OpenClaw integration guide](./openclaw-integration.md) for advanced agent patterns
5. Deploy and monitor
