# IVXP Manual Test Flow

This document provides a complete manual test flow for the current repository state.

## Preconditions

1. Default ports in current code:

- Provider: `5055`
- Receiver: `6066`

2. `export` variables in this guide only apply to the current terminal session.

3. Full payment E2E requires a working payment script and a valid on-chain transaction.
4. `ivxp-client.py` now resolves payment script in this order:

- `PAYMENT_SCRIPT_PATH` (if set)
- Project-local default: `./.skills/payment/scripts/pay`
- Legacy fallback: `~/.claude/skills/payment/scripts/pay`

## A. Pre-check (Ports and Environment)

1. Enter project directory:

```bash
cd /Users/zhengwang/Programming/ivxp-protocol
```

2. Check whether default ports are occupied:

```bash
lsof -nP -iTCP:5055 -sTCP:LISTEN
lsof -nP -iTCP:6066 -sTCP:LISTEN
```

3. If occupied, choose alternative ports (for example `5155` / `6166`) and replace them consistently in all following commands.

## B. Setup

1. Create virtual environment:

```bash
python3 -m venv .venv
```

2. Activate virtual environment:

```bash
source .venv/bin/activate
```

3. Install dependencies:

```bash
pip3 install flask eth-account web3 requests
```

4. Optional: keep payment skill local to this project:

```bash
mkdir -p .skills/payment/scripts
# Put your pay script at:
# /Users/zhengwang/Programming/ivxp-protocol/.skills/payment/scripts/pay
chmod +x .skills/payment/scripts/pay
```

5. Optional: explicitly pin payment script path:

```bash
export PAYMENT_SCRIPT_PATH="/Users/zhengwang/Programming/ivxp-protocol/.skills/payment/scripts/pay"
```

## C. Start Provider (Terminal 1)

1. Set provider env vars in Terminal 1:

```bash
export IVXP_WALLET_ADDRESS="0xYourProviderWallet"
export IVXP_AGENT_NAME="provider_agent"
```

2. Start provider:

```bash
python3 ivxp-provider.py 5055
```

3. Expected:

- Provider prints available endpoints:
  - `POST /ivxp/request`
  - `POST /ivxp/deliver`
  - `GET /ivxp/status/<order_id>`
  - `GET /ivxp/download/<order_id>`
  - `GET /ivxp/catalog`

## D. Start Receiver (Terminal 2, Optional for Push)

1. In Terminal 2:

```bash
cd /Users/zhengwang/Programming/ivxp-protocol
source .venv/bin/activate
```

2. Start receiver:

```bash
python3 ivxp-receiver.py 6066
```

3. Health check:

```bash
curl -s http://localhost:6066/ivxp/health
```

4. Expected:

- Returns JSON with `"status":"ok"`.

## E. Client Setup (Terminal 3)

1. In Terminal 3:

```bash
cd /Users/zhengwang/Programming/ivxp-protocol
source .venv/bin/activate
```

2. Set client env vars:

```bash
export WALLET_ADDRESS="0xYourClientWallet"
export WALLET_PRIVATE_KEY="0xYourClientPrivateKey"
export RECEIVE_ENDPOINT="http://localhost:6066/ivxp/receive"
```

## F. Smoke Test Without Payment (Recommended First)

1. Get catalog:

```bash
python3 ivxp-client.py catalog http://localhost:5055
```

2. Request service and input `no` when asked to send payment:

```bash
python3 ivxp-client.py request http://localhost:5055 research "manual smoke test" 50
```

3. Record `order_id`, then check status:

```bash
python3 ivxp-client.py status http://localhost:5055 <order_id>
```

4. Try download:

```bash
python3 ivxp-client.py download http://localhost:5055 <order_id>
```

5. Expected:

- Status is `quoted`.
- Download returns pending payment response (`202` with `pending_payment`/message).

## G. Full E2E (Payment + Delivery)

1. Request service again, input `yes` for payment:

```bash
python3 ivxp-client.py request http://localhost:5055 research "manual e2e test" 50
```

2. Expected provider-side logs:

- Signature verification succeeds.
- Blockchain payment verification succeeds.
- Order status transitions through `paid` then `delivered` or `delivery_failed`.

3. Push delivery verification (if Receiver running):

- Terminal 2 receives delivery log.
- Files are written to `~/.config/ivxp/deliverables`.

4. Pull delivery verification (recommended regardless):

```bash
python3 ivxp-client.py poll http://localhost:5055 <order_id> 5 20
```

5. Expected pull artifacts in current directory:

- `deliverable_<order_id>.json`
- `deliverable_<order_id>.md`

## H. Negative Cases

1. Invalid service type:

```bash
python3 ivxp-client.py request http://localhost:5055 invalid_service "bad case" 10
```

Expected: error indicating unsupported service type.

2. Non-existent order:

```bash
python3 ivxp-client.py status http://localhost:5055 ivxp-not-exist
python3 ivxp-client.py download http://localhost:5055 ivxp-not-exist
```

Expected: `404`.

3. Wrong protocol version:

```bash
curl -s -X POST http://localhost:5055/ivxp/request \
  -H 'Content-Type: application/json' \
  -d '{"protocol":"IVXP/0.9","message_type":"service_request","client_agent":{"name":"x","wallet_address":"0x1","contact_endpoint":"http://localhost:6066/ivxp/receive"},"service_request":{"type":"research","description":"x","budget_usdc":1}}'
```

Expected: unsupported protocol version error.

## I. Cleanup

1. Stop running services in each terminal with `Ctrl+C`.

2. Deactivate virtual environments:

```bash
deactivate
```

## Security Note

Current local notes files may contain plaintext private keys. Rotate test wallets and remove plaintext keys from repository files before sharing or committing.
