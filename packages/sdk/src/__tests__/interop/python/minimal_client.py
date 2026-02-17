"""
Minimal IVXP/1.0 Python Client for cross-language interop testing.

Tests the complete protocol flow against a TS Provider:
  1. GET  /ivxp/catalog           -> Fetch service catalog
  2. POST /ivxp/request           -> Request a quote
  3. POST /ivxp/deliver           -> Submit payment + delivery request
  4. GET  /ivxp/status/<order_id> -> Poll for delivery status
  5. GET  /ivxp/download/<order_id> -> Download deliverable

Uses Anvil test accounts for deterministic testing.
Outputs JSON results to stdout for the TS test orchestrator.
"""

import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests

# ---------------------------------------------------------------------------
# Test accounts (Anvil defaults - NEVER use in production)
# ---------------------------------------------------------------------------

CLIENT_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
PROVIDER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
DEFAULT_TX_HASH = (
    "0x1234567890abcdef1234567890abcdef"
    "1234567890abcdef1234567890abcdef"
)
DEFAULT_SIGNATURE = (
    "0xabababababababababababababababababababababababababababababababab"
    "abababababababababababababababababababababababababababababababababab01"
)
EXPECTED_NETWORK = "base-sepolia"

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

SNAKE_CASE_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def is_snake_case(key: str) -> bool:
    """Check if a key is snake_case."""
    return bool(SNAKE_CASE_RE.match(key))


def check_snake_case_fields(obj: Any, path: str = "") -> list[str]:
    """Recursively check all keys are snake_case. Returns violations."""
    violations: list[str] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_path = f"{path}.{key}" if path else key
            if not is_snake_case(key):
                violations.append(full_path)
            violations.extend(check_snake_case_fields(value, full_path))
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            violations.extend(
                check_snake_case_fields(item, f"{path}[{i}]")
            )
    return violations


def compute_content_hash(content: str) -> str:
    """Compute SHA-256 hash of content string."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Test runner
# ---------------------------------------------------------------------------


def run_tests(base_url: str) -> dict[str, Any]:
    """Run all interop tests against the given provider URL."""
    results: dict[str, Any] = {
        "base_url": base_url,
        "tests": [],
        "passed": 0,
        "failed": 0,
        "errors": [],
    }

    def record(
        name: str, passed: bool, details: str = "", data: Any = None
    ) -> None:
        results["tests"].append(
            {
                "name": name,
                "passed": passed,
                "details": details,
                "data": data,
            }
        )
        if passed:
            results["passed"] += 1
        else:
            results["failed"] += 1

    # -----------------------------------------------------------------------
    # Test 1: Fetch catalog
    # -----------------------------------------------------------------------
    try:
        resp = requests.get(f"{base_url}/ivxp/catalog", timeout=10)
        catalog = resp.json()

        assert resp.status_code == 200, f"Status {resp.status_code}"
        assert catalog.get("protocol") == "IVXP/1.0"
        assert catalog.get("message_type") == "service_catalog"
        assert "services" in catalog
        assert "wallet_address" in catalog
        assert catalog["wallet_address"].startswith("0x")
        assert len(catalog["services"]) > 0

        # Verify snake_case
        violations = check_snake_case_fields(catalog)
        assert not violations, f"Non-snake_case fields: {violations}"

        # Verify service structure
        for svc in catalog["services"]:
            assert "type" in svc
            assert "base_price_usdc" in svc
            assert "estimated_delivery_hours" in svc
            # No camelCase
            assert "serviceType" not in svc
            assert "basePriceUsdc" not in svc

        record("catalog_fetch", True, data=catalog)
    except Exception as e:
        record("catalog_fetch", False, str(e))
        results["errors"].append(f"catalog_fetch: {e}")

    # -----------------------------------------------------------------------
    # Test 2: Request a quote
    # -----------------------------------------------------------------------
    order_id = None
    try:
        req_body = {
            "protocol": "IVXP/1.0",
            "message_type": "service_request",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "client_agent": {
                "name": "PythonTestClient",
                "wallet_address": CLIENT_ADDRESS,
            },
            "service_request": {
                "type": "text_echo",
                "description": "Python interop test",
                "budget_usdc": 100,
            },
        }
        resp = requests.post(
            f"{base_url}/ivxp/request", json=req_body, timeout=10
        )
        quote = resp.json()

        assert resp.status_code == 200, f"Status {resp.status_code}"
        assert quote.get("protocol") == "IVXP/1.0"
        assert quote.get("message_type") == "service_quote"
        assert "order_id" in quote
        assert quote["order_id"].startswith("ivxp-")

        # Verify snake_case
        violations = check_snake_case_fields(quote)
        assert not violations, f"Non-snake_case fields: {violations}"

        # Verify nested structures
        assert "provider_agent" in quote
        assert "wallet_address" in quote["provider_agent"]
        assert "quote" in quote
        assert "price_usdc" in quote["quote"]
        assert "payment_address" in quote["quote"]
        assert "network" in quote["quote"]

        order_id = quote["order_id"]
        record("request_quote", True, data=quote)
    except Exception as e:
        record("request_quote", False, str(e))
        results["errors"].append(f"request_quote: {e}")

    # -----------------------------------------------------------------------
    # Test 3: Submit delivery request
    # -----------------------------------------------------------------------
    if order_id:
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            deliver_body = {
                "protocol": "IVXP/1.0",
                "message_type": "delivery_request",
                "timestamp": timestamp,
                "order_id": order_id,
                "payment_proof": {
                    "tx_hash": DEFAULT_TX_HASH,
                    "from_address": CLIENT_ADDRESS,
                    "network": EXPECTED_NETWORK,
                },
                "signature": DEFAULT_SIGNATURE,
                "signed_message": (
                    f"Order: {order_id} | "
                    f"Payment: {DEFAULT_TX_HASH} | "
                    f"Timestamp: {timestamp}"
                ),
            }
            resp = requests.post(
                f"{base_url}/ivxp/deliver", json=deliver_body, timeout=10
            )
            delivery = resp.json()

            assert resp.status_code == 200, f"Status {resp.status_code}"
            assert delivery.get("status") == "accepted"
            assert delivery.get("order_id") == order_id

            record("submit_delivery", True, data=delivery)
        except Exception as e:
            record("submit_delivery", False, str(e))
            results["errors"].append(f"submit_delivery: {e}")

    # -----------------------------------------------------------------------
    # Test 4: Poll status until delivered
    # -----------------------------------------------------------------------
    if order_id:
        try:
            delivered = False
            for _ in range(100):
                resp = requests.get(
                    f"{base_url}/ivxp/status/{order_id}", timeout=10
                )
                status_data = resp.json()
                if status_data.get("status") == "delivered":
                    delivered = True
                    break
                time.sleep(0.1)

            assert delivered, "Order did not reach delivered status"
            assert status_data.get("order_id") == order_id
            assert "content_hash" in status_data

            # Verify snake_case
            violations = check_snake_case_fields(status_data)
            assert not violations, f"Non-snake_case: {violations}"

            record("poll_status", True, data=status_data)
        except Exception as e:
            record("poll_status", False, str(e))
            results["errors"].append(f"poll_status: {e}")

    # -----------------------------------------------------------------------
    # Test 5: Download deliverable
    # -----------------------------------------------------------------------
    if order_id:
        try:
            resp = requests.get(
                f"{base_url}/ivxp/download/{order_id}", timeout=10
            )
            download = resp.json()

            assert resp.status_code == 200, f"Status {resp.status_code}"
            assert download.get("order_id") == order_id
            assert "content" in download
            assert "content_type" in download
            assert "content_hash" in download

            # Verify content hash integrity
            recomputed = compute_content_hash(download["content"])
            assert download["content_hash"] == recomputed, (
                f"Hash mismatch: {download['content_hash']} != {recomputed}"
            )

            # Verify snake_case
            violations = check_snake_case_fields(download)
            assert not violations, f"Non-snake_case: {violations}"

            record("download_deliverable", True, data=download)
        except Exception as e:
            record("download_deliverable", False, str(e))
            results["errors"].append(f"download_deliverable: {e}")

    # -----------------------------------------------------------------------
    # Test 6: Error handling - unknown order
    # -----------------------------------------------------------------------
    try:
        resp = requests.get(
            f"{base_url}/ivxp/status/ivxp-nonexistent", timeout=10
        )
        assert resp.status_code == 404
        record("error_unknown_order", True)
    except Exception as e:
        record("error_unknown_order", False, str(e))

    # -----------------------------------------------------------------------
    # Test 7: Error handling - wrong HTTP method
    # -----------------------------------------------------------------------
    try:
        resp = requests.post(
            f"{base_url}/ivxp/catalog", json={}, timeout=10
        )
        assert resp.status_code == 405
        record("error_wrong_method", True)
    except Exception as e:
        record("error_wrong_method", False, str(e))

    # -----------------------------------------------------------------------
    # Test 8: Protocol field naming - no camelCase
    # -----------------------------------------------------------------------
    try:
        resp = requests.get(f"{base_url}/ivxp/catalog", timeout=10)
        catalog = resp.json()
        raw_text = resp.text

        # Check no camelCase keys exist in raw JSON
        camel_patterns = [
            "serviceType",
            "basePriceUsdc",
            "walletAddress",
            "messageType",
            "estimatedDeliveryHours",
            "providerAgent",
            "orderId",
            "priceUsdc",
            "paymentAddress",
            "contentHash",
            "contentType",
            "createdAt",
        ]
        found_camel = [p for p in camel_patterns if p in raw_text]
        assert not found_camel, f"camelCase fields found: {found_camel}"

        record("no_camel_case", True)
    except Exception as e:
        record("no_camel_case", False, str(e))

    # -----------------------------------------------------------------------
    # Test 9: Timestamp format (ISO 8601)
    # -----------------------------------------------------------------------
    try:
        resp = requests.get(f"{base_url}/ivxp/catalog", timeout=10)
        catalog = resp.json()
        ts = catalog.get("timestamp", "")
        # Basic ISO 8601 check
        assert "T" in ts, f"Not ISO 8601: {ts}"
        assert len(ts) > 10, f"Timestamp too short: {ts}"
        record("timestamp_format", True, data={"timestamp": ts})
    except Exception as e:
        record("timestamp_format", False, str(e))

    # -----------------------------------------------------------------------
    # Test 10: Address format (0x-prefixed hex)
    # -----------------------------------------------------------------------
    try:
        resp = requests.get(f"{base_url}/ivxp/catalog", timeout=10)
        catalog = resp.json()
        addr = catalog.get("wallet_address", "")
        assert addr.startswith("0x"), f"No 0x prefix: {addr}"
        assert len(addr) == 42, f"Wrong length: {len(addr)}"
        record("address_format", True, data={"address": addr})
    except Exception as e:
        record("address_format", False, str(e))

    return results


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python minimal_client.py <provider_url>", file=sys.stderr)
        sys.exit(1)

    provider_url = sys.argv[1].rstrip("/")
    results = run_tests(provider_url)

    # Output JSON results to stdout
    print(json.dumps(results, indent=2))

    # Exit with error code if any tests failed
    sys.exit(1 if results["failed"] > 0 else 0)
