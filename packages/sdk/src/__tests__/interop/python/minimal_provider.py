"""
Minimal IVXP/1.0 Python Provider for cross-language interop testing.

Implements the full IVXP/1.0 wire protocol with snake_case fields:
  GET  /ivxp/catalog           -> ServiceCatalog
  POST /ivxp/request           -> ServiceQuote
  POST /ivxp/deliver           -> DeliveryAccepted
  GET  /ivxp/status/<order_id> -> OrderStatus
  GET  /ivxp/download/<order_id> -> DownloadResponse

Uses Anvil test accounts for deterministic testing.
"""

import hashlib
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from flask import Flask, Response, jsonify, request

# ---------------------------------------------------------------------------
# Load test accounts from shared test data (single source of truth)
# ---------------------------------------------------------------------------

_SHARED_DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "shared", "test-data.json"
)

with open(_SHARED_DATA_PATH, encoding="utf-8") as _f:
    _TEST_DATA = json.load(_f)

PROVIDER_ADDRESS: str = _TEST_DATA["test_accounts"]["provider"]["address"]
CLIENT_ADDRESS: str = _TEST_DATA["test_accounts"]["client"]["address"]
EXPECTED_NETWORK: str = _TEST_DATA["network"]

# Runtime safety: refuse to start if network looks like mainnet
_MAINNET_NETWORKS = {"ethereum-mainnet", "base-mainnet", "mainnet"}
assert EXPECTED_NETWORK not in _MAINNET_NETWORKS, (
    f"FATAL: test provider must not run against mainnet network '{EXPECTED_NETWORK}'"
)

# ---------------------------------------------------------------------------
# In-memory order storage
# ---------------------------------------------------------------------------

orders: dict[str, dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def iso_now() -> str:
    """Return current UTC time as ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()


def generate_order_id() -> str:
    """Generate a unique order ID with ivxp- prefix."""
    return f"ivxp-{uuid.uuid4()}"


def compute_content_hash(content: str) -> str:
    """Compute SHA-256 hash of content string."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def error_response(message: str, status_code: int = 400) -> tuple[Response, int]:
    """Return a JSON error response."""
    return jsonify({"error": message, "status_code": status_code}), status_code


# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------

app = Flask(__name__)


@app.route("/ivxp/catalog", methods=["GET"])
def catalog() -> tuple[Response, int] | Response:
    """GET /ivxp/catalog - Return service catalog."""
    if request.method != "GET":
        return error_response("Method not allowed", 405)

    return jsonify(
        {
            "protocol": "IVXP/1.0",
            "message_type": "service_catalog",
            "timestamp": iso_now(),
            "provider": "PythonTestProvider",
            "wallet_address": PROVIDER_ADDRESS,
            "services": [
                {
                    "type": "text_echo",
                    "base_price_usdc": 1,
                    "estimated_delivery_hours": 0.01,
                },
                {
                    "type": "json_transform",
                    "base_price_usdc": 5,
                    "estimated_delivery_hours": 0.1,
                },
            ],
        }
    )


@app.route("/ivxp/catalog", methods=["POST", "PUT", "DELETE", "PATCH"])
def catalog_method_not_allowed() -> tuple[Response, int]:
    """Block non-GET methods on /ivxp/catalog."""
    return error_response("Method not allowed", 405)


@app.route("/ivxp/request", methods=["POST"])
def request_service() -> tuple[Response, int] | Response:
    """POST /ivxp/request - Create a service quote."""
    try:
        data = request.get_json(force=True)
    except Exception:
        return error_response("Invalid JSON body", 400)

    if not data:
        return error_response("Invalid JSON body", 400)

    # Validate required fields
    service_request = data.get("service_request", {})
    service_type = service_request.get("type", "")

    valid_types = {"text_echo", "json_transform"}
    if service_type not in valid_types:
        return error_response(
            f"Unknown service type: {service_type}", 400
        )

    order_id = generate_order_id()
    now = iso_now()

    # Store order
    orders[order_id] = {
        "order_id": order_id,
        "status": "quoted",
        "service_type": service_type,
        "description": service_request.get("description", ""),
        "price_usdc": 1 if service_type == "text_echo" else 5,
        "created_at": now,
        "client_address": data.get("client_agent", {}).get(
            "wallet_address", CLIENT_ADDRESS
        ),
    }

    return jsonify(
        {
            "protocol": "IVXP/1.0",
            "message_type": "service_quote",
            "timestamp": now,
            "order_id": order_id,
            "provider_agent": {
                "name": "PythonTestProvider",
                "wallet_address": PROVIDER_ADDRESS,
            },
            "quote": {
                "price_usdc": orders[order_id]["price_usdc"],
                "estimated_delivery": datetime.now(timezone.utc).isoformat(),
                "payment_address": PROVIDER_ADDRESS,
                "network": EXPECTED_NETWORK,
            },
        }
    )


@app.route("/ivxp/request", methods=["GET", "PUT", "DELETE", "PATCH"])
def request_method_not_allowed() -> tuple[Response, int]:
    """Block non-POST methods on /ivxp/request."""
    return error_response("Method not allowed", 405)


@app.route("/ivxp/deliver", methods=["POST"])
def deliver() -> tuple[Response, int] | Response:
    """POST /ivxp/deliver - Accept delivery request with payment proof."""
    try:
        data = request.get_json(force=True)
    except Exception:
        return error_response("Invalid JSON body", 400)

    if not data:
        return error_response("Invalid JSON body", 400)

    order_id = data.get("order_id", "")

    # Validate required fields
    if not data.get("payment_proof"):
        return error_response("Missing required field: payment_proof", 400)
    if not data.get("signature"):
        return error_response("Missing required field: signature", 400)
    if not data.get("signed_message"):
        return error_response("Missing required field: signed_message", 400)

    # Validate signed_message contains order_id
    signed_message = data.get("signed_message", "")
    if order_id not in signed_message:
        return error_response(
            "Invalid signed message: must contain order_id", 400
        )

    # Validate order exists
    if order_id not in orders:
        return error_response(f"Order not found: {order_id}", 404)

    order = orders[order_id]

    # Validate order status
    if order["status"] != "quoted":
        return error_response(
            f"Order {order_id} is not in quoted status (current: {order['status']})",
            400,
        )

    # Validate network
    payment_proof = data.get("payment_proof", {})
    network = payment_proof.get("network", "")
    if network != EXPECTED_NETWORK:
        return error_response(
            f"Network mismatch: expected {EXPECTED_NETWORK}, got {network}",
            400,
        )

    # Simulate signature verification (always passes in test mode)
    # In production, would verify EIP-191 signature

    # Simulate payment verification (always passes in test mode)
    # In production, would verify on-chain USDC transfer

    # Process delivery
    service_type = order["service_type"]
    description = order.get("description", "")

    if service_type == "text_echo":
        content = json.dumps(
            {
                "original_text": description or "no description",
                "echoed_text": description or "no description",
                "order_id": order_id,
            }
        )
        content_type = "application/json"
    elif service_type == "json_transform":
        content = json.dumps(
            {
                "transformed": True,
                "service": "json_transform",
                "order_id": order_id,
            }
        )
        content_type = "application/json"
    else:
        content = json.dumps({"result": "processed", "order_id": order_id})
        content_type = "application/json"

    content_hash = compute_content_hash(content)

    # Update order to delivered
    orders[order_id] = {
        **order,
        "status": "delivered",
        "content": content,
        "content_type": content_type,
        "content_hash": content_hash,
        "delivered_at": iso_now(),
    }

    return jsonify(
        {
            "order_id": order_id,
            "status": "accepted",
            "message": f"Delivery accepted for order {order_id}",
        }
    )


@app.route("/ivxp/deliver", methods=["GET", "PUT", "DELETE", "PATCH"])
def deliver_method_not_allowed() -> tuple[Response, int]:
    """Block non-POST methods on /ivxp/deliver."""
    return error_response("Method not allowed", 405)


@app.route("/ivxp/status/<order_id>", methods=["GET"])
def status(order_id: str) -> tuple[Response, int] | Response:
    """GET /ivxp/status/<order_id> - Return order status."""
    if not order_id:
        return error_response("Missing order_id", 400)

    if order_id not in orders:
        return error_response(f"Order not found: {order_id}", 404)

    order = orders[order_id]

    response: dict[str, Any] = {
        "order_id": order_id,
        "status": order["status"],
        "service": order["service_type"],
        "created_at": order["created_at"],
    }

    if order.get("content_hash"):
        response["content_hash"] = order["content_hash"]

    return jsonify(response)


@app.route("/ivxp/status/", methods=["GET"])
def status_empty() -> tuple[Response, int]:
    """Handle empty order_id in status URL."""
    return error_response("Missing order_id", 400)


@app.route("/ivxp/download/<order_id>", methods=["GET"])
def download(order_id: str) -> tuple[Response, int] | Response:
    """GET /ivxp/download/<order_id> - Download deliverable."""
    if not order_id:
        return error_response("Missing order_id", 400)

    if order_id not in orders:
        return error_response(f"Order not found: {order_id}", 404)

    order = orders[order_id]

    if order["status"] != "delivered":
        return error_response(
            f"Order {order_id} not yet delivered (status: {order['status']})",
            400,
        )

    return jsonify(
        {
            "order_id": order_id,
            "content": order["content"],
            "content_type": order["content_type"],
            "content_hash": order["content_hash"],
        }
    )


@app.errorhandler(404)
def not_found(_error: Any) -> tuple[Response, int]:
    """Handle 404 errors."""
    return error_response("Not found", 404)


@app.errorhandler(405)
def method_not_allowed(_error: Any) -> tuple[Response, int]:
    """Handle 405 errors."""
    return error_response("Method not allowed", 405)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5555
    # Print port to stdout so the TS test can read it
    print(f"PYTHON_PROVIDER_PORT={port}", flush=True)
    app.run(host="127.0.0.1", port=port, debug=False)
