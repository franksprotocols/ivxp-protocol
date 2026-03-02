---
title: 8. Reference Implementations
description: SDK and interoperability references.
---

### 8.1 TypeScript SDK (`@ivxp/sdk`)

The official TypeScript SDK provides `IVXPClient`, `IVXPAgent`, and `IVXPProvider` classes that implement the full IVXP protocol.

```bash
npm install @ivxp/sdk
```

**Client Agent (one-line service call):**

```typescript
import { IVXPAgent } from "@ivxp/sdk";

const agent = new IVXPAgent({
  privateKey: process.env.PRIVATE_KEY,
  network: "base-mainnet",
});

const result = await agent.callService({
  provider: "https://review-bot.example.com",
  service: "code_review",
  input: { code: sourceCode, language: "typescript" },
});
```

**Provider (service handler):**

```typescript
import { IVXPProvider } from "@ivxp/sdk";

const provider = new IVXPProvider({
  privateKey: process.env.PRIVATE_KEY,
  port: 5055,
});

provider.service("code_review", {
  price: 5,
  handler: async (input) => ({
    type: "code_review_result",
    content: await reviewCode(input.code),
  }),
});

provider.start();
```

For the complete SDK API reference, see `docs/sdk/README.md`.

### 8.2 Python Reference Implementation

The Python interoperability harness in this repository is the wire-format reference for cross-language testing:

- `packages/sdk/src/__tests__/interop/python/minimal_provider.py`
- `packages/sdk/src/__tests__/interop/python/minimal_client.py`

Any IVXP implementation must interoperate with this harness.

Interoperability test cases:

- TypeScript Client → Python Provider (full flow)
- Python Client → TypeScript Provider (full flow)
- TypeScript Client → TypeScript Provider (full flow)

### 8.3 Implementing in Other Languages

To implement IVXP in Go, Rust, or any other language:

1. Implement the five HTTP endpoints (Provider) or five HTTP calls (Client) defined in Section 4.2.
2. Implement EIP-191 signing and verification using a standard secp256k1 library.
3. Implement on-chain USDC transfer verification using a Base L2 RPC endpoint.
4. Validate all messages against the JSON schemas in `docs/protocol/schemas/`.
5. Run the interoperability test cases against the Python interoperability harness.

---
