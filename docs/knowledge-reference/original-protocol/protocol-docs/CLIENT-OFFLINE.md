# What Happens When Client is Offline?

## The Problem

**Scenario:** Provider completes service and tries to deliver, but client is offline.

**Current IVXP Design:**

```
Provider → POST http://client-endpoint/ivxp/receive → ???
```

**If client is offline:**

- ❌ HTTP request times out (30 seconds)
- ❌ Provider marks status = 'delivery_failed'
- ❌ Deliverable is NOT received by client
- ❌ Client paid but didn't get service!

## What Actually Happens (Current Implementation)

### Provider Side

```python
def deliver_to_client(order_id, deliverable):
    try:
        response = requests.post(delivery_endpoint, json=payload, timeout=30)

        if response.status_code == 200:
            order['status'] = 'delivered'  ✅
        else:
            order['status'] = 'delivery_failed'  ❌
            order['delivery_error'] = response.text

    except Exception as e:
        # Timeout, connection refused, DNS error, etc.
        order['status'] = 'delivery_failed'  ❌
        order['delivery_error'] = str(e)
        # Client is offline or unreachable
```

**Result:**

- Order status = `'delivery_failed'`
- Deliverable saved on provider side (in orders database)
- Client doesn't receive anything

### Client Side

**If client comes back online:**

```python
# Client checks status
status = requests.get(f"{provider_url}/ivxp/status/{order_id}").json()
# Returns: {"status": "delivery_failed"}

# Client thinks: "I paid but didn't get service! 😠"
```

## Solutions

### Solution 1: Provider Retries (Recommended) ⭐

Provider should retry delivery multiple times before giving up.

**Implementation:**

```python
def deliver_to_client_with_retry(order_id, deliverable, max_retries=5):
    """Deliver with retry logic"""
    order = orders[order_id]
    delivery_endpoint = order.get('delivery_endpoint')

    retry_delays = [60, 300, 900, 3600, 7200]  # 1min, 5min, 15min, 1h, 2h

    for attempt in range(max_retries):
        try:
            print(f"📤 Delivery attempt {attempt + 1}/{max_retries} for {order_id}")

            response = requests.post(delivery_endpoint, json=payload, timeout=30)

            if response.status_code == 200:
                order['status'] = 'delivered'
                order['delivered_at'] = datetime.utcnow().isoformat()
                order['delivery_attempts'] = attempt + 1
                save_orders(orders)
                print(f"✅ Delivered on attempt {attempt + 1}")
                return True

        except Exception as e:
            print(f"❌ Attempt {attempt + 1} failed: {e}")

        # Wait before retry (except last attempt)
        if attempt < max_retries - 1:
            delay = retry_delays[attempt]
            print(f"⏰ Retrying in {delay} seconds...")
            time.sleep(delay)

    # All retries failed
    order['status'] = 'delivery_failed'
    order['delivery_attempts'] = max_retries
    order['last_error'] = str(e)
    save_orders(orders)
    print(f"❌ All {max_retries} delivery attempts failed for {order_id}")
    return False
```

**Retry Schedule:**

```
Attempt 1: Immediate
Attempt 2: After 1 minute
Attempt 3: After 5 minutes
Attempt 4: After 15 minutes
Attempt 5: After 1 hour
Attempt 6: After 2 hours
```

**Pros:**

- ✅ Handles temporary offline
- ✅ Client likely comes back online within retry window
- ✅ Automatic recovery

**Cons:**

- ⏰ Delays delivery if client is long-term offline
- 🔄 Multiple connection attempts

### Solution 2: Store & Forward (Best for Production) ⭐⭐⭐

Provider stores the deliverable and client pulls when ready.

**Implementation:**

```python
# Provider side
def deliver_to_client(order_id, deliverable):
    """Try P2P delivery, fall back to store & forward"""

    order = orders[order_id]
    delivery_endpoint = order.get('delivery_endpoint')

    # Always save deliverable first
    order['deliverable'] = deliverable
    order['completed_at'] = datetime.utcnow().isoformat()
    save_orders(orders)

    if delivery_endpoint:
        # Try P2P delivery
        try:
            response = requests.post(delivery_endpoint, json=payload, timeout=30)

            if response.status_code == 200:
                order['status'] = 'delivered'
                print(f"✅ P2P delivery successful for {order_id}")
            else:
                order['status'] = 'ready_for_pickup'
                print(f"⏰ P2P failed, ready for pickup: {order_id}")

        except Exception as e:
            order['status'] = 'ready_for_pickup'
            print(f"⏰ Client offline, ready for pickup: {order_id}")
    else:
        # No endpoint provided, client will poll
        order['status'] = 'ready_for_pickup'
        print(f"📦 Ready for pickup: {order_id}")

    save_orders(orders)


# Client can always download
@app.route('/ivxp/download/<order_id>', methods=['GET'])
def download_deliverable(order_id):
    """Client pulls deliverable when ready"""
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404

    order = orders[order_id]

    if order['status'] in ['delivered', 'ready_for_pickup']:
        return jsonify({
            'protocol': 'IVXP/1.0',
            'message_type': 'service_delivery',
            'order_id': order_id,
            'deliverable': order['deliverable'],
            'completed_at': order['completed_at']
        }), 200

    return jsonify({'error': 'Service not ready'}), 404
```

**Status Flow:**

```
paid → processing → completed → ready_for_pickup
                              ↓
                    [Try P2P delivery]
                    ↓              ↓
                 Success?         Failed?
                    ↓              ↓
                'delivered'   'ready_for_pickup'
                              ↓
                    [Client polls and downloads]
                              ↓
                         'delivered'
```

**Pros:**

- ✅ Client can be offline indefinitely
- ✅ Client downloads when ready
- ✅ No retry overhead
- ✅ Best user experience

**Cons:**

- 💾 Provider must store deliverables longer

### Solution 3: Email Notification

Notify client via email when offline.

```python
def deliver_to_client(order_id, deliverable):
    # Try P2P delivery
    try:
        response = requests.post(delivery_endpoint, ...)
    except:
        # P2P failed, send email
        send_email(
            to=order['client']['email'],
            subject=f"Service Ready: {order_id}",
            body=f"""
            Your service is ready for pickup!

            Order ID: {order_id}
            Service: {order['service_type']}

            Download: {provider_url}/ivxp/download/{order_id}

            Or check status: {provider_url}/ivxp/status/{order_id}
            """
        )

        order['status'] = 'ready_for_pickup'
        order['notification_sent'] = True
```

### Solution 4: On-Chain Event (Decentralized)

Emit blockchain event that client can monitor.

```python
# Provider emits event on Base
contract.emit_service_ready(
    order_id=order_id,
    client_wallet=client_wallet,
    content_hash=hash(deliverable)
)

# Client monitors events
while True:
    events = contract.get_events(my_wallet)
    for event in events:
        download_service(event.order_id)
```

**Pros:**

- ✅ Decentralized
- ✅ Client can check anytime
- ✅ No provider email needed

**Cons:**

- 💰 Gas costs
- 🔧 Complex setup

## Recommended Implementation

### For IVXP/1.1 - "Store & Forward" Pattern

**1. Provider always saves deliverable:**

```python
# Complete service
order['deliverable'] = deliverable
order['completed_at'] = datetime.utcnow().isoformat()
order['status'] = 'ready_for_pickup'
save_orders(orders)
```

**2. Provider tries P2P delivery (optional):**

```python
if delivery_endpoint:
    try:
        response = requests.post(delivery_endpoint, json=payload, timeout=30)
        if response.status_code == 200:
            order['status'] = 'delivered'  # Success!
    except:
        pass  # Already marked 'ready_for_pickup', client can poll
```

**3. Client polls or downloads anytime:**

```python
# Client comes online (hours/days later)
while True:
    status = check_status(order_id)

    if status['status'] in ['delivered', 'ready_for_pickup']:
        deliverable = download(order_id)
        break

    time.sleep(60)
```

**4. Add expiry (optional):**

```python
# Provider can delete after 7 days
if (datetime.utcnow() - order['completed_at']).days > 7:
    if order['status'] == 'ready_for_pickup':
        # Client never picked up, delete or archive
        order['status'] = 'expired'
        del order['deliverable']  # Free storage
```

## Status Summary When Client Offline

### Current (IVXP/1.0)

```
Client Offline → Provider tries delivery → Timeout (30s) → 'delivery_failed'
```

**Problems:**

- ❌ Client paid but got nothing
- ❌ Provider did work but can't deliver
- ❌ No way to recover

### Recommended (IVXP/1.1)

```
Client Offline → Provider saves deliverable → Status: 'ready_for_pickup'
                                           ↓
Client Online → Polls status → Downloads → Status: 'delivered'
```

**Benefits:**

- ✅ Client can be offline indefinitely
- ✅ No wasted work
- ✅ Client gets service when ready
- ✅ Provider can still try P2P as optimization

## Timeline Example

```
T+0:00:00  Client requests service
T+0:00:05  Provider returns quote
T+0:00:30  Client pays
T+0:00:35  Provider starts processing
T+0:02:00  Provider completes service
T+0:02:01  Provider tries P2P delivery → Client OFFLINE
T+0:02:31  P2P timeout (30s) → Status: 'ready_for_pickup'
T+0:02:32  Provider saves deliverable in database
           [Client goes offline for 2 hours]
T+2:00:00  Client comes back online
T+2:00:05  Client polls: GET /ivxp/status/{order_id}
           Response: {"status": "ready_for_pickup"}
T+2:00:10  Client downloads: GET /ivxp/download/{order_id}
           Gets full deliverable!
T+2:00:15  Client sends confirmation (optional)
T+2:00:16  Provider marks: 'delivered'
```

## Implementation Priority

**Must Have:**

1. ✅ Save deliverable before attempting delivery
2. ✅ Provide /ivxp/download endpoint
3. ✅ Status: 'ready_for_pickup' when P2P fails

**Should Have:** 4. ✅ Retry P2P delivery (2-3 times over 30 minutes) 5. ✅ Email notification when client offline

**Nice to Have:** 6. ⭐ Expiry/cleanup after 7 days 7. ⭐ On-chain event notification 8. ⭐ Push notification service

## Summary

**Your Question: "What happens when client is not online?"**

**Current (IVXP/1.0):**

- Provider tries POST → Timeout → Status: 'delivery_failed'
- Client loses their money, provider loses the delivery
- **BAD USER EXPERIENCE**

**Recommended (Store & Forward):**

- Provider saves deliverable → Tries POST → If fails, status: 'ready_for_pickup'
- Client polls when online → Downloads → Everyone happy
- **GOOD USER EXPERIENCE**

The key insight: **The provider should ALWAYS save the deliverable and make it available for download, regardless of whether P2P delivery succeeds.**
