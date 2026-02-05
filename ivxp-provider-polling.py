# Add this to ivxp-provider.py to support polling delivery

@app.route('/ivxp/download/<order_id>', methods=['GET'])
def download_deliverable(order_id):
    """Download completed deliverable (for polling clients who don't have public endpoint)"""
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

    if order['status'] == 'delivery_failed':
        # For clients that couldn't receive P2P, allow download
        if 'deliverable' in order:
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
                'note': 'Retrieved via polling (P2P delivery failed)'
            }), 200

    if order['status'] == 'delivered':
        # Service already delivered, allow re-download
        if 'deliverable' in order:
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
                'delivered_at': order.get('delivered_at')
            }), 200

    return jsonify({
        'error': 'Service not yet completed',
        'status': order['status']
    }), 404

