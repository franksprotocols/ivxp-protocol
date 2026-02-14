# IVXP Service Delivery Status Tracking

## Current Status Flow

### Provider-Side Statuses

The IVXP provider tracks these statuses:

```
1. 'quoted'          → Service requested, quote sent to client
2. 'paid'            → Payment verified, service processing started
3. 'delivered'       → Service POSTed to client successfully (HTTP 200)
4. 'delivery_failed' → Failed to POST to client (HTTP error or timeout)
```

### Status Lifecycle

```
[Client Requests]
      ↓
   'quoted' ────────────────────────────────────────┐
      ↓                                              │
[Client Pays]                                        │
      ↓                                              │
   'paid' ─────────────────────────────────────────┤
      ↓                                              │
[Provider Processes Service]                         │
      ↓                                              │
[Provider POSTs to Client]                          │
      ↓                                              ↓
    Success (200)?                            [Timeout/Error]
      ↓ YES                                          ↓
  'delivered' ✅                            'delivery_failed' ❌
```

### What "delivered" Means

**Current Implementation:**

```python
# Provider delivers
response = requests.post(delivery_endpoint, json=payload, timeout=30)

if response.status_code == 200:
    order['status'] = 'delivered'  ← Provider marks as delivered
    order['delivered_at'] = datetime.utcnow().isoformat()
```

**"delivered" = "Provider successfully POSTed to client's endpoint"**

It means:
- ✅ HTTP POST succeeded
- ✅ Client's server returned 200 OK
- ❌ Does NOT guarantee client saved it
- ❌ Does NOT mean client confirmed receipt
- ❌ Does NOT mean client is satisfied

### Problem: No Client Confirmation

**Current flow:**
```
Provider → POST deliverable → Client returns 200 → Provider marks "delivered"
```

**Missing:**
- No proof client actually saved the deliverable
- No client signature on receipt
- No satisfaction confirmation
- No way for client to dispute non-receipt
```

## How Clients Check Status

### Option 1: Pull Status (Current)

Client can poll the provider:

```bash
GET /ivxp/status/<order_id>
```

**Response:**
```json
{
  "order_id": "ivxp-123...",
  "status": "delivered",  ← Provider's view of delivery
  "created_at": "2026-02-05T10:00:00Z",
  "service_type": "research",
  "price_usdc": 50
}
```

**This tells you:**
- ✅ Whether provider attempted delivery
- ✅ Whether provider thinks it was successful
- ❌ NOT whether YOU actually received it

### Option 2: Receive Push (Current - P2P)

Client runs server, provider POSTs:

```python
@app.route('/ivxp/receive', methods=['POST'])
def receive():
    data = request.json
    # Save deliverable
    save_deliverable(data)
    return jsonify({'status': 'received'}), 200  ← This makes provider mark "delivered"
```

**Problem:**
- Client returning 200 doesn't mean client confirmed receipt
- Just means HTTP request succeeded
- No cryptographic proof of receipt

## What's Missing: Receipt Confirmation

### Current vs Ideal

**Current (IVXP/1.0):**
```
Provider delivers → Client returns HTTP 200 → Provider marks "delivered" → DONE
```

**Ideal (IVXP/1.1):**
```
Provider delivers → Client returns HTTP 200 → Provider marks "posted"
    ↓
Client verifies content → Client signs receipt → Sends to provider
    ↓
Provider verifies signature → Marks "client_confirmed" → DONE
```

### Proposed: Delivery Confirmation Message

**After receiving deliverable, client should send:**

```json
{
  "protocol": "IVXP/1.1",
  "message_type": "delivery_confirmation",
  "timestamp": "2026-02-05T16:05:00Z",
  "order_id": "ivxp-550e8400-...",
  "client_agent": {
    "name": "client_bot",
    "wallet_address": "0x1234..."
  },
  "confirmation": {
    "received": true,
    "content_hash": "0xabcd...",  ← Hash of received content
    "received_at": "2026-02-05T16:00:00Z",
    "satisfaction_rating": 5
  },
  "signature": "0x...",
  "signed_message": "Order: ivxp-550e8400... | Received: true | Hash: 0xabcd... | Timestamp: ..."
}
```

**Provider verifies signature and updates:**
```python
order['status'] = 'client_confirmed'
order['client_confirmation'] = confirmation_data
```

### Benefits of Confirmation

**For Provider:**
- ✅ Cryptographic proof client received service
- ✅ Content hash proves what was delivered
- ✅ Satisfaction rating for reputation
- ✅ Dispute protection

**For Client:**
- ✅ Can dispute if provider claims delivered but client didn't receive
- ✅ Cryptographic proof of what they received
- ✅ Record for future reference

## Recommended Status System (IVXP/1.1)

### Enhanced Status Flow

```
'quoted'           → Service requested, waiting for payment
'paid'             → Payment confirmed, processing started
'processing'       → Service being fulfilled
'ready'            → Service ready, attempting delivery
'posted'           → Successfully POSTed to client (HTTP 200)
'client_confirmed' → Client signed receipt confirmation
'delivery_failed'  → Failed to deliver (timeout/error)
'disputed'         → Client disputes receipt
```

### Status Check Response (Enhanced)

```json
{
  "order_id": "ivxp-123...",
  "status": "client_confirmed",
  "status_details": {
    "created_at": "2026-02-05T10:00:00Z",
    "paid_at": "2026-02-05T10:05:00Z",
    "posted_at": "2026-02-05T16:00:00Z",
    "confirmed_at": "2026-02-05T16:05:00Z"
  },
  "service_type": "research",
  "price_usdc": 50,
  "client_satisfaction": 5
}
```

## Implementation Guide

### For Providers (Current IVXP/1.0)

**Check if client received:**

The only way to know is if:
1. HTTP POST returned 200 (status = 'delivered')
2. No error occurred (status != 'delivery_failed')

**But this doesn't guarantee client actually has it!**

### For Clients (Current IVXP/1.0)

**Two ways to receive:**

**Option A: Run server (Push)**
```python
@app.route('/ivxp/receive', methods=['POST'])
def receive():
    data = request.json
    order_id = data['order_id']

    # YOU are responsible for:
    # 1. Validating the delivery
    # 2. Saving the deliverable
    # 3. Returning 200 only if successful

    try:
        save_deliverable(order_id, data['deliverable'])
        return jsonify({'status': 'received'}), 200  # Provider marks "delivered"
    except:
        return jsonify({'error': 'Failed to save'}), 500  # Provider marks "delivery_failed"
```

**Option B: Poll status (Pull)**
```python
while True:
    status = requests.get(f"{provider_url}/ivxp/status/{order_id}").json()

    if status['status'] == 'delivered':
        # Provider thinks they delivered
        # Now download it
        response = requests.get(f"{provider_url}/ivxp/download/{order_id}")
        deliverable = response.json()
        save_deliverable(order_id, deliverable)
        break

    time.sleep(30)
```

## Summary

### Your Question: "Is there status of the service delivered such as posted to the client?"

**Yes, but limited:**

**Provider tracks:**
- `'delivered'` - Successfully POSTed to client (HTTP 200)
- `'delivery_failed'` - Failed to POST

**But:**
- ❌ No separate "posted" vs "confirmed" status
- ❌ No client acknowledgment required
- ❌ No cryptographic receipt from client

### Your Question: "Or it will be pulling from the client?"

**Both are supported:**

**Pull (Polling):**
```bash
# Client pulls status
GET /ivxp/status/<order_id>

# When status = 'delivered', download
GET /ivxp/download/<order_id>
```

**Push (P2P POST):**
```bash
# Provider pushes to client
POST http://client-endpoint/ivxp/receive
```

### Recommendations

**For IVXP/1.0 (Current):**
- Use polling if client doesn't have public server
- Status 'delivered' = provider successfully POSTed
- Client should verify deliverable immediately after receiving

**For IVXP/1.1 (Future):**
- Add 'posted' status (HTTP succeeded)
- Add 'client_confirmed' status (client signed receipt)
- Add delivery confirmation message
- Add content hash verification
- Add dispute mechanism

## Next Steps

Would you like me to:
1. Add delivery confirmation to the IVXP protocol spec?
2. Implement receipt signing in ivxp-client.py?
3. Add 'posted' vs 'confirmed' status tracking in ivxp-provider.py?
