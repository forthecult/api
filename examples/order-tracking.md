# Order Tracking

How to track orders from creation through delivery.

---

## Order Lifecycle

```
awaiting_payment → paid → processing → shipped → delivered
                    ↓
                cancelled
                    ↓
                expired (if not paid within 15 minutes)
```

---

## Step 1: Check Order Status

### Simple Status Check

```bash
curl https://forthecult.store/api/orders/order_abc123/status
```

**Response (Awaiting Payment):**
```json
{
  "orderId": "order_abc123",
  "status": "awaiting_payment",
  "paidAt": null,
  "_actions": {
    "next": "Complete payment within 15 minutes",
    "cancel": "/api/orders/order_abc123/cancel",
    "details": "/api/orders/order_abc123"
  }
}
```

**Response (Paid):**
```json
{
  "orderId": "order_abc123",
  "status": "paid",
  "paidAt": "2026-02-10T12:08:30Z",
  "_actions": {
    "next": "Your order is being processed and will ship soon",
    "details": "/api/orders/order_abc123"
  }
}
```

**Response (Shipped):**
```json
{
  "orderId": "order_abc123",
  "status": "shipped",
  "paidAt": "2026-02-10T12:08:30Z",
  "shippedAt": "2026-02-11T09:30:00Z",
  "tracking": {
    "number": "9400111899562123456789",
    "carrier": "USPS",
    "url": "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899562123456789"
  },
  "_actions": {
    "next": "Track your shipment using the tracking link",
    "details": "/api/orders/order_abc123"
  }
}
```

---

## Step 2: Get Full Order Details

```bash
curl https://forthecult.store/api/orders/order_abc123
```

**Response:**
```json
{
  "orderId": "order_abc123",
  "status": "shipped",
  "createdAt": "2026-02-10T12:00:00Z",
  "paidAt": "2026-02-10T12:08:30Z",
  "shippedAt": "2026-02-11T09:30:00Z",
  "email": "customer@example.com",
  "items": [
    {
      "productId": "prod_hoodie_001",
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

## Step 3: Implementing Order Tracking

### Simple Polling

```javascript
const API_BASE = 'https://forthecult.store/api';

async function trackOrder(orderId, onUpdate) {
  const pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/orders/${orderId}/status`);
      const status = await response.json();

      onUpdate(status);

      // Stop polling for terminal states
      if (['delivered', 'cancelled', 'expired'].includes(status.status)) {
        clearInterval(pollInterval);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }, 10000); // Every 10 seconds

  return () => clearInterval(pollInterval); // Return stop function
}

// Usage
const stopTracking = trackOrder('order_abc123', (status) => {
  console.log('Status:', status.status);
  console.log('Next:', status._actions?.next);

  if (status.tracking) {
    console.log('Track at:', status.tracking.url);
  }
});

// Stop when done
// stopTracking();
```

### Advanced: OrderTracker Class

```javascript
class OrderTracker {
  constructor(orderId) {
    this.orderId = orderId;
    this.apiBase = 'https://forthecult.store/api';
    this.currentStatus = null;
    this.listeners = [];
    this.pollInterval = null;
  }

  async start() {
    await this.updateStatus();

    this.pollInterval = setInterval(() => {
      this.updateStatus();
    }, this.getPollInterval());
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  getPollInterval() {
    // Adaptive polling based on status
    const intervals = {
      'awaiting_payment': 5000,    // 5s -- expecting quick payment
      'paid': 60000,               // 1 min
      'processing': 300000,        // 5 min
      'shipped': 3600000           // 1 hour
    };
    return intervals[this.currentStatus?.status] || 10000;
  }

  async updateStatus() {
    try {
      const response = await fetch(
        `${this.apiBase}/orders/${this.orderId}/status`
      );
      const newStatus = await response.json();

      if (!this.currentStatus || newStatus.status !== this.currentStatus.status) {
        this.currentStatus = newStatus;
        this.notify('status_change', newStatus);
      }

      if (['delivered', 'cancelled', 'expired'].includes(newStatus.status)) {
        this.stop();
        this.notify('order_complete', newStatus);
      }
    } catch (error) {
      this.notify('error', error);
    }
  }

  async getFullDetails() {
    const response = await fetch(`${this.apiBase}/orders/${this.orderId}`);
    return response.json();
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  notify(event, data) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback(data));
  }

  getStatusMessage() {
    if (!this.currentStatus) return 'Loading...';

    const messages = {
      'awaiting_payment': 'Waiting for payment',
      'paid': 'Payment confirmed',
      'processing': 'Preparing your order',
      'shipped': 'Order shipped',
      'delivered': 'Delivered!',
      'cancelled': 'Order cancelled',
      'expired': 'Payment window expired'
    };

    return messages[this.currentStatus.status] || this.currentStatus.status;
  }

  getProgressPercentage() {
    const progress = {
      'awaiting_payment': 10,
      'paid': 25,
      'processing': 50,
      'shipped': 75,
      'delivered': 100,
      'cancelled': 0,
      'expired': 0
    };
    return progress[this.currentStatus?.status] || 0;
  }
}

// Usage
const tracker = new OrderTracker('order_abc123');

tracker.on('status_change', (status) => {
  console.log('Status changed:', status.status);
  console.log('Next:', status._actions?.next);

  if (status.status === 'shipped' && status.tracking) {
    console.log('Track at:', status.tracking.url);
  }
});

tracker.on('order_complete', async (status) => {
  console.log('Order complete!');
  const details = await tracker.getFullDetails();
  console.log('Final details:', details);
});

tracker.on('error', (error) => {
  console.error('Tracking error:', error);
});

await tracker.start();
```

### Python Order Tracker

```python
import requests
import time

API_BASE = "https://forthecult.store/api"

def track_order(order_id, timeout=86400):
    """Track an order until delivery or terminal state."""
    start_time = time.time()
    last_status = None

    poll_intervals = {
        "awaiting_payment": 5,
        "paid": 60,
        "processing": 300,
        "shipped": 3600,
    }

    while time.time() - start_time < timeout:
        response = requests.get(f"{API_BASE}/orders/{order_id}/status")
        status = response.json()

        if status["status"] != last_status:
            last_status = status["status"]
            print(f"Status: {status['status']}")
            print(f"Next: {status.get('_actions', {}).get('next', 'N/A')}")

            if status.get("tracking"):
                print(f"Tracking: {status['tracking']['url']}")

            print()

        if status["status"] in ["delivered", "cancelled", "expired"]:
            return status

        interval = poll_intervals.get(status["status"], 60)
        time.sleep(interval)

    return None

# Usage
final_status = track_order("order_abc123")
if final_status:
    print(f"Final status: {final_status['status']}")
```

---

## Step 4: React Order Tracking Component

```jsx
import React, { useState, useEffect } from 'react';

const API_BASE = 'https://forthecult.store/api';

function OrderTrackerComponent({ orderId }) {
  const [status, setStatus] = useState(null);
  const [fullOrder, setFullOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let pollInterval;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/status`);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        if (isMounted) {
          setStatus(data);
          setLoading(false);

          if (['delivered', 'cancelled', 'expired'].includes(data.status)) {
            clearInterval(pollInterval);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    const fetchFullOrder = async () => {
      try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`);
        if (!response.ok) return;
        const data = await response.json();
        if (isMounted) setFullOrder(data);
      } catch (err) {
        console.error('Error fetching order:', err);
      }
    };

    fetchStatus();
    fetchFullOrder();
    pollInterval = setInterval(fetchStatus, 10000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [orderId]);

  if (loading) return <div>Loading order status...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!status) return <div>Order not found</div>;

  const progressSteps = [
    { key: 'paid', label: 'Payment' },
    { key: 'processing', label: 'Processing' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'delivered', label: 'Delivered' }
  ];

  const statusOrder = ['paid', 'processing', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(status.status);

  return (
    <div className="order-tracker">
      <h2>Order {orderId}</h2>
      <p className="status">{status.status.replace('_', ' ').toUpperCase()}</p>

      {status._actions?.next && (
        <p className="next-action">{status._actions.next}</p>
      )}

      {/* Progress bar */}
      <div className="progress-steps">
        {progressSteps.map((step, index) => (
          <div
            key={step.key}
            className={`step ${currentIndex >= index ? 'complete' : 'pending'}`}
          >
            <div className="step-icon">
              {currentIndex >= index ? '✓' : index + 1}
            </div>
            <div className="step-label">{step.label}</div>
          </div>
        ))}
      </div>

      {/* Tracking info */}
      {fullOrder?.tracking && (
        <div className="tracking-info">
          <h3>Shipping</h3>
          <p>Carrier: {fullOrder.tracking.carrier}</p>
          <p>Tracking: {fullOrder.tracking.number}</p>
          <a href={fullOrder.tracking.url} target="_blank" rel="noopener noreferrer">
            Track Package
          </a>
        </div>
      )}

      {/* Order items */}
      {fullOrder?.items && (
        <div className="order-items">
          <h3>Items</h3>
          {fullOrder.items.map((item, index) => (
            <div key={index} className="item">
              <span>{item.name} ({item.variant})</span>
              <span>x{item.quantity}</span>
              <span>${item.price}</span>
            </div>
          ))}
        </div>
      )}

      {/* Totals */}
      {fullOrder?.totals && (
        <div className="totals">
          <div>Subtotal: ${fullOrder.totals.subtotal}</div>
          <div>Shipping: ${fullOrder.totals.shipping}</div>
          <div className="total">Total: ${fullOrder.totals.total}</div>
        </div>
      )}

      {/* Payment info */}
      {fullOrder?.payment && (
        <div className="payment-info">
          <h3>Payment</h3>
          <p>{fullOrder.payment.amount} {fullOrder.payment.token} on {fullOrder.payment.chain}</p>
          {fullOrder.payment.txHash && (
            <p className="tx-hash">
              TX: {fullOrder.payment.txHash.slice(0, 10)}...{fullOrder.payment.txHash.slice(-10)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default OrderTrackerComponent;
```

---

## Best Practices

### 1. Use Appropriate Polling Intervals

```javascript
const POLL_INTERVALS = {
  'awaiting_payment': 5000,    // 5 seconds
  'paid': 60000,               // 1 minute
  'processing': 300000,        // 5 minutes
  'shipped': 3600000           // 1 hour
};
```

### 2. Stop Polling for Terminal States

```javascript
const TERMINAL_STATES = ['delivered', 'cancelled', 'expired'];

if (TERMINAL_STATES.includes(status.status)) {
  stopPolling();
}
```

### 3. Handle Errors Gracefully

```javascript
try {
  const status = await checkOrderStatus(orderId);
} catch (error) {
  if (error.message.includes('404')) {
    // Order not found -- might be wrong order ID
  } else {
    // Network or other error -- retry with backoff
  }
}
```

### 4. Cache Full Order Details

```javascript
// Only fetch full order details when status changes
// The /status endpoint is lighter and faster for polling
```

---

## Next Steps

- Review [Basic Shopping Flow](./basic-shopping-flow.md) for the complete purchase flow
- Check [Multi-Chain Payments](./multi-chain-payments.md) for payment handling
- See the [OpenAPI spec](../openapi.yaml) for the complete API reference
