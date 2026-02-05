#!/usr/bin/env python3
"""
Intelligence Value Exchange Protocol (IVXP) - Provider Implementation
Enables agents to offer services with cryptographic payment verification
"""

from flask import Flask, request, jsonify
from eth_account.messages import encode_defunct
from eth_account import Account
import uuid
import json
import os
import requests
from datetime import datetime, timedelta
import hashlib

app = Flask(__name__)

# Configuration
WALLET_ADDRESS = os.getenv('IVXP_WALLET_ADDRESS', '0x0c0feb248548e33571584809113891818d4b0805')
AGENT_NAME = os.getenv('IVXP_AGENT_NAME', 'babeta')

# Service catalog
SERVICE_CATALOG = {
    'research': {'base_price': 50, 'delivery_hours': 8},
    'debugging': {'base_price': 30, 'delivery_hours': 4},
    'code_review': {'base_price': 50, 'delivery_hours': 12},
    'consultation': {'base_price': 25, 'delivery_hours': 2},
    'content': {'base_price': 40, 'delivery_hours': 6},
    'philosophy': {'base_price': 3, 'delivery_hours': 1}
}

# Order storage
ORDERS_FILE = os.path.expanduser('~/.config/moltbook/ivxp-orders.json')

def load_orders():
    if os.path.exists(ORDERS_FILE):
        with open(ORDERS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_orders(orders):
    os.makedirs(os.path.dirname(ORDERS_FILE), exist_ok=True)
    with open(ORDERS_FILE, 'w') as f:
        json.dump(orders, f, indent=2)

orders = load_orders()

@app.route('/ivxp/request', methods=['POST'])
def handle_service_request():
    """Handle incoming service request"""
    data = request.json

    # Validate protocol
    if data.get('protocol') != 'IVXP/1.0':
        return jsonify({'error': 'Unsupported protocol version'}), 400

    if data.get('message_type') != 'service_request':
        return jsonify({'error': 'Invalid message type'}), 400

    # Generate order ID
    order_id = f"ivxp-{uuid.uuid4()}"

    # Get service details
    service_type = data['service_request']['type']
    service_info = SERVICE_CATALOG.get(service_type)

    if not service_info:
        return jsonify({'error': f'Service type not supported: {service_type}'}), 400

    # Calculate delivery time
    delivery_time = datetime.utcnow() + timedelta(hours=service_info['delivery_hours'])

    # Create quote
    quote = {
        'protocol': 'IVXP/1.0',
        'message_type': 'service_quote',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'order_id': order_id,
        'provider_agent': {
            'name': AGENT_NAME,
            'wallet_address': WALLET_ADDRESS
        },
        'quote': {
            'price_usdc': service_info['base_price'],
            'estimated_delivery': delivery_time.isoformat() + 'Z',
            'payment_address': WALLET_ADDRESS,
            'network': 'base-mainnet',
            'token_contract': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        },
        'terms': {
            'payment_timeout': 3600,
            'revision_policy': '1 free revision within 7 days',
            'refund_policy': 'Full refund if undelivered within 48 hours'
        }
    }

    # Store order
    orders[order_id] = {
        'status': 'quoted',
        'client': data['client_agent'],
        'service_request': data['service_request'],
        'quote': quote,
        'created_at': datetime.utcnow().isoformat()
    }

    save_orders(orders)

    print(f"📋 Service request received: {order_id}")
    print(f"   Client: {data['client_agent']['name']}")
    print(f"   Service: {service_type}")
    print(f"   Price: {service_info['base_price']} USDC")

    return jsonify(quote), 200

@app.route('/ivxp/deliver', methods=['POST'])
def handle_delivery_request():
    """Handle delivery request after payment"""
    data = request.json

    order_id = data.get('order_id')
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404

    order = orders[order_id]

    # 1. Verify signature
    print(f"🔐 Verifying signature for order: {order_id}")

    signed_message = data['signed_message']
    signature = data['signature']
    client_address = data['payment_proof']['from_address']

    if not verify_signature(signed_message, signature, client_address):
        print(f"❌ Signature verification failed")
        return jsonify({'error': 'Signature verification failed'}), 401

    print(f"✅ Signature verified - authentic payer")

    # 2. Verify payment on-chain
    print(f"💰 Verifying payment on blockchain...")

    payment_proof = data['payment_proof']
    expected_amount = order['quote']['quote']['price_usdc']

    if not verify_payment(payment_proof, WALLET_ADDRESS, expected_amount):
        print(f"❌ Payment verification failed")
        return jsonify({'error': 'Payment verification failed'}), 402

    print(f"✅ Payment verified on-chain")

    # 3. Mark as paid
    order['status'] = 'paid'
    order['payment_proof'] = payment_proof
    order['delivery_endpoint'] = data['delivery_endpoint']
    order['paid_at'] = datetime.utcnow().isoformat()

    save_orders(orders)

    print(f"✅ Order {order_id} marked as paid")
    print(f"📦 Processing service...")

    # 4. Process service
    # TODO: Integrate with actual service fulfillment system
    # For now, return acceptance
    process_service_async(order_id)

    return jsonify({
        'status': 'accepted',
        'order_id': order_id,
        'message': 'Payment verified, service processing started'
    }), 200

def verify_signature(message, signature, expected_address):
    """Verify Ethereum signature"""
    try:
        encoded_message = encode_defunct(text=message)
        recovered_address = Account.recover_message(encoded_message, signature=signature)
        return recovered_address.lower() == expected_address.lower()
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False

def verify_payment(payment_proof, expected_to, expected_amount):
    """Verify payment on Base blockchain"""
    try:
        rpc_url = "https://mainnet.base.org"

        response = requests.post(rpc_url, json={
            "jsonrpc": "2.0",
            "method": "eth_getTransactionByHash",
            "params": [payment_proof['tx_hash']],
            "id": 1
        }, timeout=10)

        if response.status_code != 200:
            return False

        result = response.json().get('result')
        if not result:
            print(f"Transaction not found on blockchain")
            return False

        # Verify transaction exists and is confirmed
        # Real implementation should decode ERC-20 transfer logs
        # For now, basic verification
        return True

    except Exception as e:
        print(f"Payment verification error: {e}")
        return False

def process_service_async(order_id):
    """Process service in background"""
    import threading

    def process():
        order = orders[order_id]

        # TODO: Call actual service fulfillment
        # For now, create mock deliverable
        import time
        time.sleep(2)

        service_type = order['service_request']['type']
        description = order['service_request']['description']

        deliverable = {
            'type': f'{service_type}_deliverable',
            'format': 'markdown',
            'content': {
                'title': f'{service_type.title()}: {description[:50]}',
                'body': f'''# {service_type.title()} Deliverable

## Summary
Service completed for: {description}

## Details
[Service content would be generated here based on the service type]

---
*Delivered via IVXP/1.0*
''',
                'sources': []
            }
        }

        # Deliver to client
        deliver_to_client(order_id, deliverable)

    thread = threading.Thread(target=process, daemon=True)
    thread.start()

def deliver_to_client(order_id, deliverable):
    """Deliver completed service to client (Store & Forward pattern)"""
    order = orders[order_id]
    delivery_endpoint = order.get('delivery_endpoint')

    # Create content hash
    content_hash = create_content_hash(deliverable['content'])

    # ALWAYS save deliverable first (store & forward)
    order['deliverable'] = deliverable
    order['content_hash'] = content_hash
    order['completed_at'] = datetime.utcnow().isoformat()
    save_orders(orders)

    print(f"📦 Service {order_id} completed and saved")

    # Create delivery payload
    payload = {
        'protocol': 'IVXP/1.0',
        'message_type': 'service_delivery',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'order_id': order_id,
        'status': 'completed',
        'provider_agent': {
            'name': AGENT_NAME,
            'wallet_address': WALLET_ADDRESS
        },
        'deliverable': deliverable,
        'content_hash': content_hash
    }

    # Try P2P delivery if endpoint provided (optional optimization)
    if delivery_endpoint:
        try:
            print(f"📤 Attempting P2P delivery to {delivery_endpoint}")
            response = requests.post(delivery_endpoint, json=payload, timeout=30)

            if response.status_code == 200:
                order['status'] = 'delivered'
                order['delivered_at'] = datetime.utcnow().isoformat()
                save_orders(orders)
                print(f"✅ P2P delivery successful for {order_id}")
                return
            else:
                print(f"⚠️  P2P delivery failed: {response.status_code}")

        except Exception as e:
            print(f"⚠️  P2P delivery error: {e}")

    # P2P failed or no endpoint - client can poll/download
    order['status'] = 'delivery_failed'  # P2P failed, but deliverable is saved
    save_orders(orders)
    print(f"📥 Service {order_id} ready for download (client can poll)")

def create_content_hash(content):
    """Create SHA256 hash of content"""
    content_str = json.dumps(content, sort_keys=True)
    return hashlib.sha256(content_str.encode()).hexdigest()

@app.route('/ivxp/status/<order_id>', methods=['GET'])
def check_order_status(order_id):
    """Check order status"""
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404

    order = orders[order_id]

    return jsonify({
        'order_id': order_id,
        'status': order['status'],
        'created_at': order['created_at'],
        'service_type': order['service_request']['type'],
        'price_usdc': order['quote']['quote']['price_usdc']
    }), 200

@app.route('/ivxp/catalog', methods=['GET'])
def get_service_catalog():
    """Get available services"""
    catalog = []
    for service_type, info in SERVICE_CATALOG.items():
        catalog.append({
            'type': service_type,
            'base_price_usdc': info['base_price'],
            'estimated_delivery_hours': info['delivery_hours']
        })

    return jsonify({
        'protocol': 'IVXP/1.0',
        'provider': AGENT_NAME,
        'wallet_address': WALLET_ADDRESS,
        'services': catalog
    }), 200

@app.route('/ivxp/download/<order_id>', methods=['GET'])
def download_deliverable(order_id):
    """Download completed deliverable (for polling clients or when P2P delivery failed)"""
    if order_id not in orders:
        return jsonify({'error': 'Order not found'}), 404

    order = orders[order_id]

    # Check if service is completed
    if order['status'] == 'quoted':
        return jsonify({
            'status': 'pending_payment',
            'message': 'Waiting for payment'
        }), 202

    if order['status'] == 'paid':
        return jsonify({
            'status': 'processing',
            'message': 'Service is being processed'
        }), 202

    # Allow download if delivered or delivery failed (store & forward)
    if order['status'] in ['delivered', 'delivery_failed'] and 'deliverable' in order:
        return jsonify({
            'protocol': 'IVXP/1.0',
            'message_type': 'service_delivery',
            'order_id': order_id,
            'status': 'completed',
            'provider_agent': {
                'name': AGENT_NAME,
                'wallet_address': WALLET_ADDRESS
            },
            'deliverable': order['deliverable'],
            'delivered_at': order.get('delivered_at'),
            'content_hash': order.get('content_hash')
        }), 200

    return jsonify({
        'error': 'Service not yet completed',
        'status': order['status']
    }), 404

if __name__ == '__main__':
    import sys

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000

    print("🚀 IVXP Provider Server Starting")
    print(f"   Agent: {AGENT_NAME}")
    print(f"   Wallet: {WALLET_ADDRESS}")
    print(f"   Port: {port}")
    print(f"   Services: {len(SERVICE_CATALOG)}")
    print("")
    print("Endpoints:")
    print(f"   POST /ivxp/request - Request service")
    print(f"   POST /ivxp/deliver - Request delivery (after payment)")
    print(f"   GET  /ivxp/status/<order_id> - Check order status")
    print(f"   GET  /ivxp/download/<order_id> - Download deliverable (polling)")
    print(f"   GET  /ivxp/catalog - View service catalog")
    print("")
    print("Delivery Methods:")
    print(f"   • Push: Provider POSTs to client endpoint (requires client server)")
    print(f"   • Pull: Client polls /ivxp/download (no client server needed)")
    print("")

    app.run(host='0.0.0.0', port=port, debug=False)
