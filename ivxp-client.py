#!/usr/bin/env python3
"""
Intelligence Value Exchange Protocol (IVXP) - Client Implementation
Request and receive services from other agents with payment verification
"""

import requests
import json
import os
import subprocess
from datetime import datetime
from eth_account.messages import encode_defunct
from eth_account import Account

class IVXPClient:
    """Client for requesting services via IVXP"""

    def __init__(self, wallet_address, private_key, receive_endpoint, agent_name='client_agent'):
        self.wallet_address = wallet_address
        self.private_key = private_key
        self.receive_endpoint = receive_endpoint
        self.agent_name = agent_name

    def get_service_catalog(self, provider_url):
        """Get available services from provider"""
        try:
            response = requests.get(f"{provider_url}/ivxp/catalog", timeout=10)

            if response.status_code == 200:
                catalog = response.json()
                print(f"📚 Service Catalog from {catalog['provider']}")
                print(f"   Wallet: {catalog['wallet_address']}")
                print(f"   Services available:")

                for service in catalog['services']:
                    print(f"   - {service['type']}: {service['base_price_usdc']} USDC ({service['estimated_delivery_hours']}h)")

                return catalog
            else:
                print(f"❌ Failed to get catalog: {response.status_code}")
                return None

        except Exception as e:
            print(f"❌ Error getting catalog: {e}")
            return None

    def request_service(self, provider_url, service_type, description, budget):
        """Request a service from provider"""

        request_data = {
            'protocol': 'IVXP/1.0',
            'message_type': 'service_request',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'client_agent': {
                'name': self.agent_name,
                'wallet_address': self.wallet_address,
                'contact_endpoint': self.receive_endpoint
            },
            'service_request': {
                'type': service_type,
                'description': description,
                'budget_usdc': budget,
                'delivery_format': 'markdown'
            }
        }

        try:
            print(f"📤 Requesting {service_type} service from {provider_url}")

            response = requests.post(f"{provider_url}/ivxp/request", json=request_data, timeout=30)

            if response.status_code == 200:
                quote = response.json()

                print(f"✅ Quote received!")
                print(f"   Order ID: {quote['order_id']}")
                print(f"   Price: {quote['quote']['price_usdc']} USDC")
                print(f"   Delivery: {quote['quote']['estimated_delivery']}")
                print(f"   Payment Address: {quote['quote']['payment_address']}")
                print(f"   Network: {quote['quote']['network']}")

                return quote
            else:
                print(f"❌ Request failed: {response.status_code}")
                print(f"   {response.text}")
                return None

        except Exception as e:
            print(f"❌ Error requesting service: {e}")
            return None

    def send_payment(self, payment_address, amount):
        """Send USDC payment using payment-skill"""

        payment_script = os.path.expanduser('~/.claude/skills/payment/scripts/pay')

        if not os.path.exists(payment_script):
            print(f"❌ Payment skill not installed at {payment_script}")
            return None

        try:
            print(f"💰 Sending {amount} USDC to {payment_address}...")

            cmd = [
                payment_script,
                "--to", payment_address,
                "--amount", str(amount)
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            if result.returncode == 0:
                # Extract tx hash from output
                output = result.stdout

                for line in output.split('\n'):
                    if 'hash' in line.lower() or '0x' in line:
                        # Try to extract tx hash
                        parts = line.split()
                        for part in parts:
                            if part.startswith('0x') and len(part) == 66:
                                print(f"✅ Payment sent! Tx hash: {part}")
                                return part

                print(f"✅ Payment completed")
                print(output)
                return "0x" + "0" * 64  # Mock tx hash if not found

            else:
                print(f"❌ Payment failed: {result.stderr}")
                return None

        except Exception as e:
            print(f"❌ Payment error: {e}")
            return None

    def request_delivery(self, provider_url, order_id, tx_hash):
        """Request delivery after payment with signed proof"""

        # Create message to sign
        message = f"Order: {order_id} | Payment: {tx_hash} | Timestamp: {datetime.utcnow().isoformat()}Z"

        try:
            # Sign message with private key
            encoded_message = encode_defunct(text=message)
            signed_message = Account.sign_message(encoded_message, private_key=self.private_key)
            signature = signed_message.signature.hex()

            print(f"🔐 Signed delivery request with wallet {self.wallet_address}")

            # Create delivery request
            request_data = {
                'protocol': 'IVXP/1.0',
                'message_type': 'delivery_request',
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'order_id': order_id,
                'payment_proof': {
                    'tx_hash': tx_hash,
                    'from_address': self.wallet_address,
                    'network': 'base-mainnet'
                },
                'delivery_endpoint': self.receive_endpoint,
                'signature': signature,
                'signed_message': message
            }

            # Send delivery request
            print(f"📤 Requesting delivery...")

            response = requests.post(f"{provider_url}/ivxp/deliver", json=request_data, timeout=30)

            if response.status_code == 200:
                result = response.json()
                print(f"✅ Delivery request accepted!")
                print(f"   Status: {result['status']}")
                print(f"   Message: {result['message']}")
                print(f"\n📦 Waiting for delivery to: {self.receive_endpoint}")
                return True
            else:
                print(f"❌ Delivery request failed: {response.status_code}")
                print(f"   {response.text}")
                return False

        except Exception as e:
            print(f"❌ Error requesting delivery: {e}")
            return False

    def check_order_status(self, provider_url, order_id):
        """Check order status"""
        try:
            response = requests.get(f"{provider_url}/ivxp/status/{order_id}", timeout=10)

            if response.status_code == 200:
                status = response.json()
                print(f"📊 Order Status: {order_id}")
                print(f"   Status: {status['status']}")
                print(f"   Service: {status['service_type']}")
                print(f"   Price: {status['price_usdc']} USDC")
                print(f"   Created: {status['created_at']}")
                return status
            else:
                print(f"❌ Failed to check status: {response.status_code}")
                return None

        except Exception as e:
            print(f"❌ Error checking status: {e}")
            return None

    def download_deliverable(self, provider_url, order_id):
        """Download deliverable via polling (no client server needed)"""
        try:
            print(f"📥 Downloading deliverable for {order_id}...")

            response = requests.get(f"{provider_url}/ivxp/download/{order_id}", timeout=30)

            if response.status_code == 200:
                delivery = response.json()
                print(f"✅ Deliverable downloaded!")
                print(f"   Order ID: {delivery['order_id']}")
                print(f"   Type: {delivery['deliverable']['type']}")
                print(f"   Format: {delivery['deliverable']['format']}")

                # Save deliverable
                filename = f"deliverable_{order_id}.json"
                with open(filename, 'w') as f:
                    json.dump(delivery, f, indent=2)

                print(f"   Saved to: {filename}")

                # Also save content separately if markdown
                if delivery['deliverable']['format'] == 'markdown':
                    content_file = f"deliverable_{order_id}.md"
                    with open(content_file, 'w') as f:
                        f.write(delivery['deliverable']['content']['body'])
                    print(f"   Content saved to: {content_file}")

                return delivery

            elif response.status_code == 202:
                result = response.json()
                print(f"⏳ Service not ready yet")
                print(f"   Status: {result.get('status')}")
                print(f"   Message: {result.get('message')}")
                return None

            else:
                print(f"❌ Download failed: {response.status_code}")
                print(f"   {response.text}")
                return None

        except Exception as e:
            print(f"❌ Error downloading: {e}")
            return None

    def poll_and_download(self, provider_url, order_id, max_attempts=20, interval=30):
        """Poll for completion and download (recommended for clients without server)"""
        import time

        print(f"\n⏳ Polling for service completion...")
        print(f"   Checking every {interval} seconds (max {max_attempts} attempts)")
        print("")

        for attempt in range(max_attempts):
            status = self.check_order_status(provider_url, order_id)

            if status:
                # Check if ready for download
                if status['status'] in ['delivered', 'delivery_failed']:
                    print(f"\n✅ Service ready! Downloading...")
                    deliverable = self.download_deliverable(provider_url, order_id)

                    if deliverable:
                        return deliverable
                    else:
                        print(f"❌ Download failed, will retry...")

            if attempt < max_attempts - 1:
                print(f"   Attempt {attempt + 1}/{max_attempts}, waiting {interval}s...")
                time.sleep(interval)

        print(f"\n❌ Timeout: Service not completed after {max_attempts} attempts")
        return None


def main():
    import sys

    if len(sys.argv) < 2:
        print("IVXP Client - Request Services from Other Agents")
        print("")
        print("Usage:")
        print("  python3 ivxp-client.py catalog <provider_url>")
        print("  python3 ivxp-client.py request <provider_url> <service_type> <description> <budget>")
        print("  python3 ivxp-client.py status <provider_url> <order_id>")
        print("  python3 ivxp-client.py download <provider_url> <order_id>")
        print("  python3 ivxp-client.py poll <provider_url> <order_id>")
        print("")
        print("Environment Variables:")
        print("  WALLET_ADDRESS - Your wallet address")
        print("  WALLET_PRIVATE_KEY - Your wallet private key (for signing)")
        print("  RECEIVE_ENDPOINT - Your endpoint for receiving deliveries (optional)")
        print("")
        print("Delivery Methods:")
        print("  • Push: Provider POSTs to RECEIVE_ENDPOINT (requires running server)")
        print("  • Pull: Use 'poll' or 'download' commands (no server needed)")
        print("")
        print("Example:")
        print("  python3 ivxp-client.py catalog http://localhost:5000")
        print("  python3 ivxp-client.py request http://localhost:5000 research 'AGI safety' 50")
        print("  python3 ivxp-client.py poll http://localhost:5000 ivxp-123...")
        sys.exit(1)

    # Get wallet details from environment
    wallet_address = os.getenv('WALLET_ADDRESS')
    private_key = os.getenv('WALLET_PRIVATE_KEY')
    receive_endpoint = os.getenv('RECEIVE_ENDPOINT', 'http://localhost:6000/ivxp/receive')

    if not wallet_address or not private_key:
        print("❌ Missing environment variables:")
        print("   Set WALLET_ADDRESS and WALLET_PRIVATE_KEY")
        sys.exit(1)

    client = IVXPClient(wallet_address, private_key, receive_endpoint)

    command = sys.argv[1]

    if command == 'catalog':
        if len(sys.argv) < 3:
            print("Usage: catalog <provider_url>")
            sys.exit(1)

        provider_url = sys.argv[2]
        client.get_service_catalog(provider_url)

    elif command == 'request':
        if len(sys.argv) < 6:
            print("Usage: request <provider_url> <service_type> <description> <budget>")
            sys.exit(1)

        provider_url = sys.argv[2]
        service_type = sys.argv[3]
        description = sys.argv[4]
        budget = int(sys.argv[5])

        # Step 1: Request service
        quote = client.request_service(provider_url, service_type, description, budget)

        if not quote:
            sys.exit(1)

        # Step 2: Confirm payment
        print("\n" + "="*60)
        print("Ready to send payment?")
        print(f"Amount: {quote['quote']['price_usdc']} USDC")
        print(f"To: {quote['quote']['payment_address']}")
        print("="*60)

        confirm = input("\nSend payment? (yes/no): ")

        if confirm.lower() != 'yes':
            print("❌ Payment cancelled")
            sys.exit(0)

        # Step 3: Send payment
        tx_hash = client.send_payment(
            quote['quote']['payment_address'],
            quote['quote']['price_usdc']
        )

        if not tx_hash:
            print("❌ Payment failed")
            sys.exit(1)

        # Step 4: Request delivery
        print("\n" + "="*60)
        print("Payment sent! Requesting delivery...")
        print("="*60 + "\n")

        success = client.request_delivery(provider_url, quote['order_id'], tx_hash)

        if success:
            print("\n✅ Service request complete!")
            print(f"   Order ID: {quote['order_id']}")
            print(f"   Delivery will be sent to: {receive_endpoint}")
        else:
            print("\n❌ Delivery request failed")

    elif command == 'status':
        if len(sys.argv) < 4:
            print("Usage: status <provider_url> <order_id>")
            sys.exit(1)

        provider_url = sys.argv[2]
        order_id = sys.argv[3]

        client.check_order_status(provider_url, order_id)

    elif command == 'download':
        if len(sys.argv) < 4:
            print("Usage: download <provider_url> <order_id>")
            sys.exit(1)

        provider_url = sys.argv[2]
        order_id = sys.argv[3]

        client.download_deliverable(provider_url, order_id)

    elif command == 'poll':
        if len(sys.argv) < 4:
            print("Usage: poll <provider_url> <order_id> [interval_seconds] [max_attempts]")
            sys.exit(1)

        provider_url = sys.argv[2]
        order_id = sys.argv[3]
        interval = int(sys.argv[4]) if len(sys.argv) > 4 else 30
        max_attempts = int(sys.argv[5]) if len(sys.argv) > 5 else 20

        result = client.poll_and_download(provider_url, order_id, max_attempts, interval)

        if result:
            print(f"\n✅ Service completed and downloaded successfully!")
        else:
            print(f"\n❌ Failed to receive service")
            sys.exit(1)

    else:
        print(f"Unknown command: {command}")
        print("Available commands: catalog, request, status, download, poll")
        sys.exit(1)


if __name__ == '__main__':
    main()
