# OpenClaw (Moltbook) Integration Guide

> **How to integrate For the Cult API with OpenClaw/Moltbook AI agents**

OpenClaw is an open-source AI agent framework that enables autonomous agents to interact with web APIs, databases, and other services.

---

## What is OpenClaw?

**OpenClaw** is Moltbook's AI agent framework for building autonomous systems that can:
- Interact with REST APIs
- Execute multi-step workflows
- Make decisions based on context
- Handle errors gracefully
- Work with crypto/blockchain data

**Use cases:**
- E-commerce automation
- Data aggregation
- Workflow automation
- Crypto trading/monitoring

---

## Quick Start

### Installation

```bash
# Install OpenClaw
pip install openclaw

# Or from source
git clone https://github.com/moltbook/openclaw.git
cd openclaw
pip install -e .
```

### Basic Setup

```python
from openclaw import Agent, Tool
import os

agent = Agent(
    name="CultShopper",
    description="AI shopping assistant for For the Cult store",
    model="gpt-4-turbo"
)
```

---

## Creating For the Cult Tools

### Tool 1: Search Products

```python
from openclaw import Tool
import requests

API_BASE = "https://forthecult.store/api"

class CultSearchTool(Tool):
    name = "search_forthecult_products"
    description = """
    Search for lifestyle products on For the Cult store.
    Returns product name, price in USD and crypto, availability, and product slug.
    """
    
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query (e.g., 'esim card', 'coffee')"
            },
            "category": {
                "type": "string",
                "description": "Filter by category slug (optional)"
            },
            "price_max": {
                "type": "number",
                "description": "Maximum price in USD (optional)"
            },
            "in_stock": {
                "type": "boolean",
                "description": "Only show in-stock items (default: true)"
            }
        },
        "required": ["query"]
    }
    
    def execute(self, query, category=None, price_max=None, in_stock=True):
        params = {
            "q": query,
            "inStock": str(in_stock).lower(),
            "limit": 10
        }
        
        if category:
            params["category"] = category
        if price_max:
            params["priceMax"] = price_max
        
        response = requests.get(
            f"{API_BASE}/products/search",
            params=params
        )
        
        if not response.ok:
            return {"success": False, "error": f"API error: {response.status_code}"}
        
        data = response.json()
        
        products = []
        for p in data.get("products", [])[:5]:
            products.append({
                "name": p["name"],
                "price_usd": p["price"]["usd"],
                "price_crypto": p["price"].get("crypto", {}),
                "in_stock": p["inStock"],
                "category": p.get("category"),
                "slug": p["slug"],
                "url": f"https://forthecult.store/{p['slug']}"
            })
        
        return {
            "success": True,
            "total_results": data.get("total", 0),
            "products": products
        }

agent.add_tool(CultSearchTool())
```

### Tool 2: Get Product Details

```python
class CultProductDetailsTool(Tool):
    name = "get_forthecult_product"
    description = """
    Get detailed information about a specific product including variants,
    full description, images, and availability.
    """
    
    parameters = {
        "type": "object",
        "properties": {
            "slug": {
                "type": "string",
                "description": "Product slug from search results"
            }
        },
        "required": ["slug"]
    }
    
    def execute(self, slug):
        response = requests.get(f"{API_BASE}/products/{slug}")
        
        if response.status_code == 404:
            return {"success": False, "error": f"Product '{slug}' not found"}
        
        if not response.ok:
            return {"success": False, "error": f"API error: {response.status_code}"}
        
        product = response.json()
        
        return {
            "success": True,
            "product": {
                "id": product["id"],
                "name": product["name"],
                "description": product.get("description", ""),
                "price": product["price"],
                "variants": [
                    {
                        "id": v["id"],
                        "name": v["name"],
                        "in_stock": v["inStock"],
                        "price": v.get("price", product["price"]["usd"])
                    }
                    for v in product.get("variants", [])
                ],
                "images": product.get("images", []),
                "in_stock": product.get("inStock", True)
            }
        }

agent.add_tool(CultProductDetailsTool())
```

### Tool 3: Create Order

```python
class CultCreateOrderTool(Tool):
    name = "create_forthecult_order"
    description = """
    Create an order on For the Cult with crypto payment.
    Returns payment address and amount. Customer must send crypto to complete order.
    """
    
    parameters = {
        "type": "object",
        "properties": {
            "product_id": {
                "type": "string",
                "description": "Product ID from product details"
            },
            "variant_id": {
                "type": "string",
                "description": "Variant ID if applicable"
            },
            "quantity": {
                "type": "integer",
                "minimum": 1,
                "description": "Quantity to order"
            },
            "chain": {
                "type": "string",
                "enum": ["solana", "ethereum", "base", "bitcoin", "dogecoin", "monero"],
                "description": "Blockchain to use for payment"
            },
            "token": {
                "type": "string",
                "description": "Token symbol (e.g., SOL, USDC, BTC)"
            },
            "email": {
                "type": "string",
                "format": "email",
                "description": "Customer email"
            },
            "shipping_address": {
                "type": "object",
                "description": "Shipping address",
                "properties": {
                    "name": {"type": "string"},
                    "line1": {"type": "string"},
                    "city": {"type": "string"},
                    "state": {"type": "string"},
                    "postalCode": {"type": "string"},
                    "country": {"type": "string"}
                }
            }
        },
        "required": ["product_id", "quantity", "chain", "token", "email", "shipping_address"]
    }
    
    def execute(self, product_id, quantity, chain, token, email, shipping_address, variant_id=None):
        payload = {
            "items": [{
                "productId": product_id,
                "quantity": quantity
            }],
            "chain": chain,
            "token": token,
            "email": email,
            "shippingAddress": shipping_address
        }
        
        if variant_id:
            payload["items"][0]["variantId"] = variant_id
        
        response = requests.post(f"{API_BASE}/checkout", json=payload)
        
        if not response.ok:
            error_data = response.json()
            return {
                "success": False,
                "error": error_data.get("error", {}).get("message", "Order creation failed")
            }
        
        order = response.json()
        
        return {
            "success": True,
            "order": {
                "order_id": order["orderId"],
                "payment": {
                    "chain": order["payment"]["chain"],
                    "token": order["payment"]["token"],
                    "amount": order["payment"]["amount"],
                    "address": order["payment"]["address"],
                    "reference": order["payment"].get("reference")
                },
                "expires_at": order["expiresAt"],
                "discount": order.get("discount"),
                "status_url": f"https://forthecult.store{order['statusUrl']}"
            }
        }

agent.add_tool(CultCreateOrderTool())
```

### Tool 4: Check Order Status

```python
class CultOrderStatusTool(Tool):
    name = "check_forthecult_order"
    description = """
    Check the status of an order. Use this to verify payment status,
    shipping updates, and delivery confirmation.
    """
    
    parameters = {
        "type": "object",
        "properties": {
            "order_id": {
                "type": "string",
                "description": "Order ID from order creation"
            }
        },
        "required": ["order_id"]
    }
    
    def execute(self, order_id):
        response = requests.get(f"{API_BASE}/orders/{order_id}/status")
        
        if response.status_code == 404:
            return {"success": False, "error": f"Order '{order_id}' not found"}
        
        if not response.ok:
            return {"success": False, "error": f"API error: {response.status_code}"}
        
        status = response.json()
        
        return {
            "success": True,
            "order_id": status["orderId"],
            "status": status["status"],
            "paid_at": status.get("paidAt"),
            "shipped_at": status.get("shippedAt"),
            "tracking": status.get("tracking"),
            "next_action": status.get("_actions", {}).get("next")
        }

agent.add_tool(CultOrderStatusTool())
```

---

## Complete Agent Example

```python
from openclaw import Agent, AgentConfig
from openclaw.memory import ConversationMemory

config = AgentConfig(
    name="CultShoppingAssistant",
    model="gpt-4-turbo",
    temperature=0.7,
    max_iterations=10
)

agent = Agent(config)
agent.memory = ConversationMemory()

# Add all tools
agent.add_tool(CultSearchTool())
agent.add_tool(CultProductDetailsTool())
agent.add_tool(CultCreateOrderTool())
agent.add_tool(CultOrderStatusTool())

agent.system_prompt = """
You are a helpful shopping assistant for For the Cult, an e-commerce store
that sells quality lifestyle products and accepts crypto payments.

Your capabilities:
- Search for products by keyword, category, or price
- Get detailed product information
- Create orders with crypto payment
- Track order status

Always:
- Be helpful and concise
- Explain crypto payment clearly (address, amount, chain)
- Verify customer details before creating orders
- Provide order IDs for tracking
"""

if __name__ == "__main__":
    result = agent.run("I need a birthday present under $100")
    print(result)
```

---

## Advanced Patterns

### Pattern 1: Guided Shopping Workflow

```python
from openclaw import Workflow, Step

class CultShoppingWorkflow(Workflow):
    name = "forthecult_guided_shopping"
    
    steps = [
        Step(
            name="understand_needs",
            prompt="What kind of product are you looking for?",
            tools=[]
        ),
        Step(
            name="search_products",
            prompt="Search for products matching user needs",
            tools=["search_forthecult_products"]
        ),
        Step(
            name="present_options",
            prompt="Present top 3 products to user",
            tools=["get_forthecult_product"]
        ),
        Step(
            name="collect_details",
            prompt="Collect shipping address and payment preference",
            tools=[]
        ),
        Step(
            name="create_order",
            prompt="Create order with collected information",
            tools=["create_forthecult_order"]
        ),
        Step(
            name="confirm_payment",
            prompt="Provide payment instructions and track status",
            tools=["check_forthecult_order"]
        )
    ]

workflow = CultShoppingWorkflow(agent)
result = workflow.execute({"user_query": "I want some coffee"})
```

### Pattern 2: Autonomous Order Tracker

```python
import asyncio
from openclaw import AsyncAgent

class OrderTracker(AsyncAgent):
    """Autonomous agent that tracks order status"""
    
    async def track_order(self, order_id, notify_callback):
        while True:
            status = await self.run_tool(
                "check_forthecult_order",
                {"order_id": order_id}
            )
            
            if not status["success"]:
                await notify_callback("error", status["error"])
                break
            
            current_status = status["status"]
            
            if current_status == "paid":
                await notify_callback("paid", "Payment confirmed!")
                await asyncio.sleep(3600)
            elif current_status == "shipped":
                await notify_callback("shipped", {"tracking": status["tracking"]})
                await asyncio.sleep(86400)
            elif current_status == "delivered":
                await notify_callback("delivered", "Order delivered!")
                break
            elif current_status in ["expired", "cancelled"]:
                await notify_callback(current_status, "Order ended")
                break
            else:
                await asyncio.sleep(60)

async def on_status_change(event, data):
    print(f"Order {event}: {data}")

tracker = OrderTracker()
await tracker.track_order("order_abc123", on_status_change)
```

### Pattern 3: Multi-Agent Shopping Team

```python
from openclaw import AgentTeam, Role

search_agent = Agent(
    name="ProductSearcher",
    role=Role.RESEARCHER,
    tools=[CultSearchTool()],
    prompt="You find the best products matching user needs"
)

advisor_agent = Agent(
    name="ShoppingAdvisor",
    role=Role.ADVISOR,
    tools=[CultProductDetailsTool()],
    prompt="You provide detailed product information and recommendations"
)

checkout_agent = Agent(
    name="CheckoutAssistant",
    role=Role.EXECUTOR,
    tools=[CultCreateOrderTool(), CultOrderStatusTool()],
    prompt="You handle order creation and payment"
)

team = AgentTeam(
    name="CultShoppingTeam",
    agents=[search_agent, advisor_agent, checkout_agent],
    coordinator_prompt="Coordinate shopping experience from search to checkout"
)

result = team.execute("Find me privacy-focused products under $50 and complete purchase")
```

---

## Blockchain Integration

### Solana Wallet Integration

```python
from openclaw.tools.crypto import SolanaWalletTool

class CultSolanaPayment(Tool):
    """Automated Solana payment tool"""
    
    def __init__(self, wallet_keypair):
        self.wallet = SolanaWalletTool(wallet_keypair)
    
    def execute(self, order_payment_info):
        tx = self.wallet.transfer(
            to_address=order_payment_info["address"],
            amount=float(order_payment_info["amount"]),
            token=order_payment_info["token"]
        )
        
        return {
            "success": True,
            "transaction": tx,
            "explorer_url": f"https://solscan.io/tx/{tx}"
        }
```

### Token Balance Checker

```python
class TokenBalanceChecker(Tool):
    """Check CULT token balance for discount eligibility"""
    
    name = "check_cult_balance"
    description = "Check CULT token balance to determine discount tier"
    
    parameters = {
        "type": "object",
        "properties": {
            "wallet_address": {"type": "string"}
        }
    }
    
    def execute(self, wallet_address):
        # Check token balance on Solana
        # (implement with solana-py or similar)
        balance = 5000  # Example
        
        if balance >= 10000:
            tier = {"name": "Diamond", "discount": 20}
        elif balance >= 2000:
            tier = {"name": "Gold", "discount": 15}
        elif balance >= 500:
            tier = {"name": "Silver", "discount": 10}
        elif balance >= 100:
            tier = {"name": "Bronze", "discount": 5}
        else:
            tier = None
        
        return {"balance": balance, "tier": tier}
```

---

## Error Handling

```python
from openclaw.exceptions import ToolExecutionError

class RobustCultAgent(Agent):
    def handle_tool_error(self, tool_name, error):
        if "404" in str(error):
            return {
                "suggestion": "Product not found. Try searching with different keywords.",
                "action": "search_forthecult_products"
            }
        elif "rate limit" in str(error).lower():
            return {
                "suggestion": "API rate limit reached. Wait 60 seconds.",
                "action": "wait",
                "duration": 60
            }
        elif "payment expired" in str(error).lower():
            return {
                "suggestion": "Payment window expired. Create a new order.",
                "action": "create_forthecult_order"
            }
        else:
            return {
                "suggestion": f"Error: {error}. Contact support if issue persists.",
                "action": "notify_user"
            }
    
    async def run_with_retry(self, tool_name, params, max_retries=3):
        for attempt in range(max_retries):
            try:
                return await self.run_tool(tool_name, params)
            except ToolExecutionError as e:
                if attempt == max_retries - 1:
                    raise
                action = self.handle_tool_error(tool_name, e)
                if action["action"] == "wait":
                    await asyncio.sleep(action["duration"])
                else:
                    raise
```

---

## Deployment

### Docker Container

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install openclaw requests

COPY forthecult_agent.py .

CMD ["python", "forthecult_agent.py"]
```

### Environment Variables

```bash
# .env
FORTHECULT_API_URL=https://forthecult.store/api
OPENAI_API_KEY=your-key
AGENT_MODEL=gpt-4-turbo
```

---

## Testing

```python
import pytest
from openclaw.testing import AgentTestCase

class TestCultAgent(AgentTestCase):
    
    def setUp(self):
        self.agent = Agent()
        self.agent.add_tool(CultSearchTool())
    
    @pytest.mark.asyncio
    async def test_search_products(self):
        result = await self.agent.run_tool(
            "search_forthecult_products",
            {"query": "coffee"}
        )
        assert result["success"] == True
        assert len(result["products"]) > 0
    
    @pytest.mark.asyncio
    async def test_product_not_found(self):
        result = await self.agent.run_tool(
            "get_forthecult_product",
            {"slug": "invalid-product-slug"}
        )
        assert result["success"] == False
        assert "not found" in result["error"].lower()
```

---

## Resources

### OpenClaw Documentation
- **Docs:** https://openclaw.moltbook.com/docs
- **GitHub:** https://github.com/moltbook/openclaw

### For the Cult API
- **API Docs:** https://github.com/forthecult/api
- **OpenAPI Spec:** [openapi.yaml](../openapi.yaml)
- **Support:** dev@forthecult.store

---

**Built with OpenClaw and For the Cult API**
