# How Paid Agents Receive Services - Complete Guide

## Your Questions Answered

### Q1: How can the paid agent receive the P2P service msg from the service provider?

**Current IVXP Spec:** The provider POSTs to the client's HTTP endpoint

**Problem:** Requires client to run a public server

**Solutions:**

#### Option 1: Run HTTP Server (Original Design)

```bash
python3 ivxp-receiver.py 6066
# Expose via ngrok/cloudflare/cloud server
```

#### Option 2: Polling (Easier!)

```bash
# Client just polls for completion
curl http://provider:5055/ivxp/status/ivxp-123...
curl http://provider:5055/ivxp/download/ivxp-123...
```

### Q2: Is there any service identifier to know which service is providing in case of multiple services are requested by an agent?

**Yes! The Order ID**

Each service request gets a unique identifier:

- **Format:** `ivxp-<uuid>`
- **Example:** `ivxp-550e8400-e29b-41d4-a716-446655440000`

**In the delivery message:**

```json
{
  "order_id": "ivxp-550e8400-...",  ← Identifies THIS specific service
  "provider_agent": {
    "name": "babeta",
    "wallet_address": "0x0c0f..."   ← Identifies WHO is delivering
  },
  "deliverable": {
    "type": "research_report"        ← Identifies WHAT kind of service
  }
}
```

**Track multiple services:**

```python
orders = {
    "ivxp-abc123": {"provider": "babeta", "type": "research"},
    "ivxp-def456": {"provider": "other", "type": "debugging"}
}
```

### Q3: This ID is just for one pair of agents (buyer and seller) or global?

**Per Provider (Not Global)**

- ✅ **Unique between one buyer-seller pair** for that transaction
- ✅ **Unique per provider** (each provider generates their own)
- ❌ **NOT globally unique** across all providers

**Example:**

```
Provider A generates: ivxp-550e8400-...
Provider B generates: ivxp-550e8400-... (by chance, same UUID)
```

These are DIFFERENT orders because different providers.

**For global tracking, use composite key:**

```python
global_id = f"{provider_wallet}:{order_id}"
# Example: "0x0c0f...:ivxp-550e8400-..."
```

## Complete Flow Examples

### Scenario 1: Client With Public Server

**Client Side:**

```bash
# 1. Start receiver
python3 ivxp-receiver.py 6066

# 2. Expose publicly
ngrok http 6066
# URL: https://abc123.ngrok.io

# 3. Request service
export RECEIVE_ENDPOINT="https://abc123.ngrok.io/ivxp/receive"
python3 ivxp-client.py request http://provider:5055 research "topic" 50
```

**What Happens:**

1. Client requests → Gets order_id: `ivxp-123...`
2. Client pays → Confirms payment
3. Provider processes service
4. Provider POSTs to `https://abc123.ngrok.io/ivxp/receive`
5. Client receives delivery automatically

**Delivery message includes:**

- `order_id` - Which service this is
- `provider_agent.wallet_address` - Who sent it
- `deliverable` - The actual content

### Scenario 2: Client Without Server (Polling)

**Client Side:**

```python
# 1. Request service
quote = client.request_service(provider_url, "research", "topic", 50)
order_id = quote['order_id']  # Save this!

# 2. Pay
tx_hash = client.send_payment(quote['quote']['payment_address'], 50)

# 3. Confirm payment
client.request_delivery(provider_url, order_id, tx_hash)

# 4. Poll for completion
import time
while True:
    status = client.check_order_status(provider_url, order_id)

    if status['status'] == 'completed':
        # Download deliverable
        response = requests.get(f"{provider_url}/ivxp/download/{order_id}")
        deliverable = response.json()
        print(f"✅ Service received! Order: {order_id}")
        break

    time.sleep(30)  # Check every 30 seconds
```

**What Happens:**

1. Client requests → Gets order_id: `ivxp-123...`
2. Client pays → Confirms payment
3. Client polls every 30 seconds
4. When complete, client downloads
5. Client has deliverable

### Scenario 3: Multiple Services from Different Providers

**Track Multiple Orders:**

```python
class ServiceTracker:
    def __init__(self):
        self.orders = {}

    def track(self, provider_wallet, order_id, service_type):
        key = f"{provider_wallet}:{order_id}"
        self.orders[key] = {
            'provider_wallet': provider_wallet,
            'order_id': order_id,
            'service_type': service_type,
            'status': 'requested'
        }
        return key

    def receive(self, provider_wallet, order_id, deliverable):
        key = f"{provider_wallet}:{order_id}"
        if key in self.orders:
            self.orders[key]['deliverable'] = deliverable
            self.orders[key]['status'] = 'delivered'
            return True
        return False

tracker = ServiceTracker()

# Request from babeta
quote1 = request_service("babeta_url", "research", "AGI safety", 50)
key1 = tracker.track(
    "0x0c0feb248548e33571584809113891818d4b0805",
    quote1['order_id'],
    "research"
)

# Request from other_agent
quote2 = request_service("other_url", "debugging", "Fix bug", 30)
key2 = tracker.track(
    "0x1234567890123456789012345678901234567890",
    quote2['order_id'],
    "debugging"
)

# When delivery arrives (from either provider)
@app.route('/ivxp/receive', methods=['POST'])
def receive():
    data = request.json

    success = tracker.receive(
        data['provider_agent']['wallet_address'],
        data['order_id'],
        data['deliverable']
    )

    if success:
        print(f"✅ Matched and saved order {data['order_id']}")
    else:
        print(f"⚠️  Unknown order {data['order_id']}")

    return jsonify({'status': 'received'}), 200
```

## Key Takeaways

### Service Identification

1. **order_id** uniquely identifies each service request
2. **provider_wallet** identifies who is providing
3. **deliverable.type** identifies what kind of service
4. Combine provider_wallet + order_id for global uniqueness

### Delivery Methods

1. **P2P HTTP POST** - Provider pushes to client (requires public endpoint)
2. **Polling** - Client pulls from provider (no public endpoint needed)
3. Both work with the same order_id system

### Multiple Services

1. Each request gets its own unique order_id
2. Track orders with provider_wallet + order_id as composite key
3. Match deliveries by checking both provider and order_id

### Current Limitation

- order_id is per-provider, not globally unique
- For global tracking, use: `f"{provider_wallet}:{order_id}"`
- Future IVXP/2.0 could add global transaction IDs

## Recommendations

**For Testing:**

- Use polling (no server needed)

**For Production:**

- Small scale: Use ngrok/cloudflare tunnel with ivxp-receiver.py
- Large scale: Deploy receiver on cloud server with HTTPS

**For Multiple Services:**

- Use ServiceTracker class to manage all orders
- Always track both provider_wallet and order_id
- Check provider wallet when receiving deliveries

## Files Created

1. **ivxp-receiver.py** - HTTP server to receive deliveries
2. **DELIVERY-METHODS.md** - Complete guide to all delivery options
3. **SERVICE-IDENTIFICATION.md** - Order ID system explanation
4. **ivxp-provider-polling.py** - Polling endpoint for providers

## Next Steps

Add polling support to ivxp-provider.py by adding the `/ivxp/download/<order_id>` endpoint.
