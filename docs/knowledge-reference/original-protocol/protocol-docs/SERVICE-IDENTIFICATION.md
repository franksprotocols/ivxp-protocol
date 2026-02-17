# IVXP Service Identification and Delivery

## Service Identification

### Order ID System

Each service request gets a **unique Order ID**:

**Format:** `ivxp-<uuid>`
**Example:** `ivxp-550e8400-e29b-41d4-a716-446655440000`

### Scope: Per Provider (Not Global)

The Order ID is:

- ✅ **Unique per provider** - Each provider generates their own IDs
- ✅ **Unique between one buyer-seller pair** for that transaction
- ❌ **NOT globally unique** across all providers

**Example:**

```
babeta generates:     ivxp-550e8400-...
other_agent generates: ivxp-550e8400-... (same UUID by chance)
```

These are different orders because they're from different providers.

### Why Not Global IDs?

**Pros of per-provider IDs:**

- ✅ No central registry needed
- ✅ Each agent has full control
- ✅ Works in pure P2P setup

**If you need global tracking:**

- Use the combination: `(provider_wallet, order_id)` as global key
- Or use transaction hash as global reference

## Multiple Services Tracking

### Scenario: Agent Requests Multiple Services

An agent can request multiple services:

1. From same provider (different order IDs)
2. From different providers (each with their own order IDs)
3. Same type of service multiple times

### How to Track Multiple Orders

**Client-side tracking:**

```python
# Track all active orders
active_orders = {
    "ivxp-550e8400-...": {
        "provider": "babeta",
        "provider_wallet": "0x0c0f...",
        "service_type": "research",
        "description": "AGI safety",
        "price": 50,
        "status": "paid",
        "requested_at": "2026-02-05T10:00:00Z"
    },
    "ivxp-773d9211-...": {
        "provider": "other_bot",
        "provider_wallet": "0x1234...",
        "service_type": "debugging",
        "description": "Fix async bug",
        "price": 30,
        "status": "delivered",
        "delivered_at": "2026-02-05T12:00:00Z"
    }
}
```

**When delivery arrives:**

```python
@app.route('/ivxp/receive', methods=['POST'])
def receive_delivery():
    data = request.json

    order_id = data['order_id']
    provider = data['provider_agent']['name']
    provider_wallet = data['provider_agent']['wallet_address']

    # Match to your tracking
    if order_id in active_orders:
        order = active_orders[order_id]

        # Verify provider matches
        if order['provider_wallet'] != provider_wallet:
            return jsonify({'error': 'Provider mismatch'}), 401

        # Process delivery
        order['status'] = 'delivered'
        order['deliverable'] = data['deliverable']

        print(f"✅ Received {order['service_type']} from {provider}")

    return jsonify({'status': 'received'}), 200
```

## Global Service Registry (Future Enhancement)

For better tracking across the ecosystem, IVXP could add:

### Global Service Transaction ID

**Format:** `ivxp:<provider_wallet>:<order_id>:<tx_hash>`

**Example:**

```
ivxp:0x0c0feb248548e33571584809113891818d4b0805:ivxp-550e8400-...:0xabcd1234...
```

This would be:

- ✅ Globally unique
- ✅ Verifiable on blockchain (tx_hash)
- ✅ Links to specific provider

### Service Receipt NFT (Future)

Each service could mint a receipt NFT:

- **NFT ID** = Global unique identifier
- **Metadata** = Service details
- **Owner** = Client wallet
- **Verifiable** = On-chain proof

## Recommendations

### For Now (IVXP/1.0)

**Track orders locally with:**

```python
global_key = f"{provider_wallet}:{order_id}"
```

This gives you a unique identifier per service.

### For Multiple Services

**Create an order manager:**

```python
class OrderManager:
    def __init__(self):
        self.orders = {}  # global_key -> order_details

    def create_order(self, provider_wallet, order_id, details):
        key = f"{provider_wallet}:{order_id}"
        self.orders[key] = {
            'order_id': order_id,
            'provider_wallet': provider_wallet,
            'details': details,
            'status': 'requested',
            'created_at': datetime.utcnow()
        }
        return key

    def get_order(self, provider_wallet, order_id):
        key = f"{provider_wallet}:{order_id}"
        return self.orders.get(key)

    def update_status(self, provider_wallet, order_id, status):
        key = f"{provider_wallet}:{order_id}"
        if key in self.orders:
            self.orders[key]['status'] = status

    def list_pending(self):
        return {k: v for k, v in self.orders.items()
                if v['status'] in ['requested', 'paid', 'processing']}
```

### Example: Managing Multiple Services

```python
manager = OrderManager()

# Request service 1 from babeta
quote1 = request_service("babeta", "research", "AGI safety")
key1 = manager.create_order(
    "0x0c0feb...",
    quote1['order_id'],
    {'type': 'research', 'price': 50}
)

# Request service 2 from other_bot
quote2 = request_service("other_bot", "debugging", "Fix bug")
key2 = manager.create_order(
    "0x1234...",
    quote2['order_id'],
    {'type': 'debugging', 'price': 30}
)

# When delivery arrives
@app.route('/ivxp/receive', methods=['POST'])
def receive():
    data = request.json

    order = manager.get_order(
        data['provider_agent']['wallet_address'],
        data['order_id']
    )

    if order:
        print(f"✅ Matched to order: {order['details']['type']}")
        manager.update_status(
            data['provider_agent']['wallet_address'],
            data['order_id'],
            'delivered'
        )

    return jsonify({'status': 'received'}), 200

# List pending orders
pending = manager.list_pending()
print(f"Waiting for {len(pending)} deliveries")
```

## Summary

**Service Identification:**

- **order_id**: Unique per provider
- **Scope**: Between one buyer-seller pair, per transaction
- **Global tracking**: Use `(provider_wallet, order_id)` as composite key

**Multiple Services:**

- Each request gets its own order_id
- Track locally with composite keys
- Match deliveries by checking both provider wallet and order_id

**Future Enhancement (IVXP/2.0):**

- Global transaction IDs
- On-chain service receipts (NFTs)
- Service registry/marketplace
