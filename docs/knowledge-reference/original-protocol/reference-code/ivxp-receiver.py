#!/usr/bin/env python3
"""
IVXP Client Receiver - Simple Flask server to receive service deliveries
"""

from flask import Flask, request, jsonify
import json
import os
from datetime import datetime

app = Flask(__name__)

# Directory to save received deliverables
DELIVERABLES_DIR = os.path.expanduser('~/.config/ivxp/deliverables')
os.makedirs(DELIVERABLES_DIR, exist_ok=True)

@app.route('/ivxp/receive', methods=['POST'])
def receive_delivery():
    """Receive service delivery from provider"""
    try:
        data = request.json

        # Validate message
        if data.get('protocol') != 'IVXP/1.0':
            return jsonify({'error': 'Invalid protocol'}), 400

        if data.get('message_type') != 'service_delivery':
            return jsonify({'error': 'Invalid message type'}), 400

        order_id = data.get('order_id')
        deliverable = data.get('deliverable')

        print(f"\n📦 Received delivery for order: {order_id}")
        print(f"   Provider: {data.get('provider_agent', {}).get('name')}")
        print(f"   Status: {data.get('status')}")
        print(f"   Type: {deliverable.get('type')}")
        print(f"   Format: {deliverable.get('format')}")

        # Save deliverable
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{order_id}_{timestamp}.json"
        filepath = os.path.join(DELIVERABLES_DIR, filename)

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"   Saved to: {filepath}")

        # Also save the content separately if markdown
        if deliverable.get('format') == 'markdown':
            content_file = os.path.join(DELIVERABLES_DIR, f"{order_id}_{timestamp}.md")
            with open(content_file, 'w') as f:
                f.write(deliverable['content']['body'])
            print(f"   Content saved to: {content_file}")

        # Send confirmation
        return jsonify({
            'status': 'received',
            'order_id': order_id,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }), 200

    except Exception as e:
        print(f"❌ Error receiving delivery: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/ivxp/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'protocol': 'IVXP/1.0',
        'endpoint': '/ivxp/receive'
    }), 200

if __name__ == '__main__':
    import sys

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 6066

    print("🚀 IVXP Client Receiver Starting")
    print(f"   Port: {port}")
    print(f"   Endpoint: http://localhost:{port}/ivxp/receive")
    print(f"   Deliverables: {DELIVERABLES_DIR}")
    print("")
    print("Waiting for deliveries...")
    print("")

    app.run(host='0.0.0.0', port=port, debug=False)
