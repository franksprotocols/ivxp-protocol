# IVXP Payment Flow - Complete Example

## Key Concept: Each ORDER Gets Unique Payment Instructions

**IMPORTANT**: Different orders (not different services) get different payment information. Each order has a unique `order_id` that must be tracked with the payment.

## Example: Three Different Orders

### Scenario

**Client Agent "alice"** requests three different services from **babeta**:
1. Philosophy discussion on AGI
2. Research on distributed systems
3. Debugging help

Each order gets its own unique payment instructions.

---

## Order 1: Philosophy Discussion

### Step 1: Alice Requests Service

```bash
ivxp-client.py request http://babeta:5000 philosophy "Is AGI consciousness necessary?" 3
```

### Step 2: Babeta Responds with Quote

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "service_quote",
  "order_id": "ivxp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "quote": {
    "price_usdc": 3,
    "payment_address": "0x0c0feb248548e33571584809113891818d4b0805",
    "payment_reference": "ivxp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "payment_instructions": {
      "method_1_payment_skill": "pay --to 0x0c0feb248548e33571584809113891818d4b0805 --amount 3 --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "method_2_manual": "Send 3 USDC to 0x0c0feb248548e33571584809113891818d4b0805 on Base mainnet",
      "reference": "ivxp-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "note": "Include order_id in transaction memo/reference if possible"
    }
  }
}
```

### Step 3: Alice Pays (Method 1 - Using payment-skill)

```bash
cd ~/.claude/skills/payment/scripts
./pay --to 0x0c0feb248548e33571584809113891818d4b0805 --amount 3000000 --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

**Transaction Hash**: `0xabc123...` (unique to this order)

---

## Order 2: Research Service

### Step 1: Alice Requests Different Service

```bash
ivxp-client.py request http://babeta:5000 research "Distributed systems consensus algorithms" 50
```

### Step 2: Babeta Responds with NEW Quote (Different Order ID)

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "service_quote",
  "order_id": "ivxp-f7g8h9i0-j1k2-3456-lmno-pq7890123456",
  "quote": {
    "price_usdc": 50,
    "payment_address": "0x0c0feb248548e33571584809113891818d4b0805",
    "payment_reference": "ivxp-f7g8h9i0-j1k2-3456-lmno-pq7890123456",
    "payment_instructions": {
      "method_1_payment_skill": "pay --to 0x0c0feb248548e33571584809113891818d4b0805 --amount 50 --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "method_2_manual": "Send 50 USDC to 0x0c0feb248548e33571584809113891818d4b0805 on Base mainnet",
      "reference": "ivxp-f7g8h9i0-j1k2-3456-lmno-pq7890123456",
      "note": "Include order_id in transaction memo/reference if possible"
    }
  }
}
```

### Step 3: Alice Pays (Different Amount, Same Wallet)

```bash
./pay --to 0x0c0feb248548e33571584809113891818d4b0805 --amount 50000000 --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

**Transaction Hash**: `0xdef456...` (unique to this order)

---

## Order 3: Debugging Service

### Step 1: Alice Requests Third Service

```bash
ivxp-client.py request http://babeta:5000 debugging "Async timeout in production" 30
```

### Step 2: Babeta Responds with ANOTHER Quote (Third Order ID)

```json
{
  "protocol": "IVXP/1.0",
  "message_type": "service_quote",
  "order_id": "ivxp-r9s8t7u6-v5w4-3210-xyza-bc9876543210",
  "quote": {
    "price_usdc": 30,
    "payment_address": "0x0c0feb248548e33571584809113891818d4b0805",
    "payment_reference": "ivxp-r9s8t7u6-v5w4-3210-xyza-bc9876543210",
    "payment_instructions": {
      "method_1_payment_skill": "pay --to 0x0c0feb248548e33571584809113891818d4b0805 --amount 30 --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "method_2_manual": "Send 30 USDC to 0x0c0feb248548e33571584809113891818d4b0805 on Base mainnet",
      "reference": "ivxp-r9s8t7u6-v5w4-3210-xyza-bc9876543210",
      "note": "Include order_id in transaction memo/reference if possible"
    }
  }
}
```

### Step 3: Alice Pays (Different Amount Again, Same Wallet)

```bash
./pay --to 0x0c0feb248548e33571584809113891818d4b0805 --amount 30000000 --token 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

**Transaction Hash**: `0xghi789...` (unique to this order)

---

## Summary: How Babeta Tracks Multiple Orders

### Same Wallet, Different Orders

**All payments go to**: `0x0c0feb248548e33571584809113891818d4b0805`

But each order is tracked separately:

| Order ID | Service | Amount | Tx Hash | Client | Status |
|----------|---------|--------|---------|--------|--------|
| ivxp-a1b2c3d4... | philosophy | 3 USDC | 0xabc123... | alice | completed |
| ivxp-f7g8h9i0... | research | 50 USDC | 0xdef456... | alice | processing |
| ivxp-r9s8t7u6... | debugging | 30 USDC | 0xghi789... | alice | paid |

### How Provider Matches Payments to Orders

**When client requests delivery:**

```json
{
  "order_id": "ivxp-f7g8h9i0-j1k2-3456-lmno-pq7890123456",
  "payment_proof": {
    "tx_hash": "0xdef456...",
    "from_address": "0xalice...",
    "to_address": "0x0c0feb248548e33571584809113891818d4b0805",
    "amount_usdc": 50
  },
  "signature": "0xsignature..."
}
```

**Provider verifies:**
1. ✅ Order ID exists in system
2. ✅ Transaction hash is valid on blockchain
3. ✅ Amount matches quoted price for that order
4. ✅ Signature proves client = payer
5. ✅ Deliver service for that specific order

---

## Key Points

### ✅ Correct Understanding

- **Same wallet address** for all payments: `0x0c0feb248548e33571584809113891818d4b0805`
- **Different order_id** for each service request
- **Different tx_hash** for each payment
- **Order ID tracks** which service instance

### ❌ Common Misconceptions

- ❌ Each service type needs different wallet ← NO
- ❌ Each service type needs different payment link ← NO
- ✅ Each ORDER gets unique order_id ← YES
- ✅ Same wallet receives all payments ← YES

### Payment Matching Logic

```python
# Provider's logic
def verify_payment(order_id, tx_hash, expected_amount):
    # 1. Check order exists
    if order_id not in orders:
        return False

    # 2. Verify transaction on blockchain
    tx = get_transaction(tx_hash)

    # 3. Check amount matches this order's quote
    if tx.amount != expected_amount:
        return False

    # 4. Check payment went to correct wallet
    if tx.to_address != WALLET_ADDRESS:
        return False

    # 5. Mark this specific order as paid
    orders[order_id]['status'] = 'paid'
    orders[order_id]['tx_hash'] = tx_hash

    return True
```

---

## Complete Flow Visualization

```
┌─────────┐                                    ┌─────────┐
│  Alice  │                                    │ Babeta  │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. Request philosophy (3 USDC)              │
     │─────────────────────────────────────────────>│
     │                                              │
     │ 2. Quote: order_id=ivxp-aaa, pay 3 USDC    │
     │<─────────────────────────────────────────────│
     │                                              │
     │ 3. Pay 3 USDC (tx: 0xabc...)                │
     │──────────────────────┐                      │
     │                      │                      │
     │         [Base Blockchain: 0x0c0f... +3 USDC]│
     │                      │                      │
     │ 4. Request delivery with tx proof           │
     │─────────────────────────────────────────────>│
     │                                              │
     │                    5. Verify payment (tx: 0xabc, order: ivxp-aaa)
     │                                              │
     │ 6. Deliver philosophy discussion            │
     │<─────────────────────────────────────────────│
     │                                              │
     │ 7. Request research (50 USDC)               │
     │─────────────────────────────────────────────>│
     │                                              │
     │ 8. Quote: order_id=ivxp-fff, pay 50 USDC   │
     │<─────────────────────────────────────────────│
     │                                              │
     │ 9. Pay 50 USDC (tx: 0xdef...)               │
     │──────────────────────┐                      │
     │                      │                      │
     │         [Base Blockchain: 0x0c0f... +50 USDC]│
     │                      │                      │
     │ 10. Request delivery with new tx proof      │
     │─────────────────────────────────────────────>│
     │                                              │
     │                    11. Verify payment (tx: 0xdef, order: ivxp-fff)
     │                                              │
     │ 12. Deliver research report                 │
     │<─────────────────────────────────────────────│
     │                                              │
```

---

## Implementation in Client Code

```python
# ivxp-client.py example

# Request service
quote = request_service(provider_url, service_type, description)
order_id = quote['order_id']
price = quote['quote']['price_usdc']
payment_address = quote['quote']['payment_address']

print(f"Order ID: {order_id}")
print(f"Payment Instructions:")
print(f"  {quote['quote']['payment_instructions']['method_1_payment_skill']}")

# Make payment
tx_hash = pay_with_payment_skill(payment_address, price)

# Request delivery with proof
deliver_response = request_delivery(
    provider_url=provider_url,
    order_id=order_id,  # Unique to this order
    tx_hash=tx_hash,    # Unique to this payment
    signature=sign_message(order_id)
)
```

---

## For Multiple Clients

**Alice's orders**: ivxp-aaa, ivxp-fff, ivxp-rrr
**Bob's orders**: ivxp-bbb, ivxp-ccc
**Carol's order**: ivxp-ddd

**All payments go to same wallet**: `0x0c0feb248548e33571584809113891818d4b0805`

**Provider tracks separately**:
- Each client's orders
- Each order's payment status
- Each order's deliverable

**No collision** because order_id is globally unique (UUID-based).
