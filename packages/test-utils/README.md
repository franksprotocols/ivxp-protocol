# @ivxp/test-utils

Shared test utilities, fixtures, and mocks for the IVXP Protocol packages.

## Install

```bash
npm install --save-dev @ivxp/test-utils
```

## Usage

```typescript
import {
  TEST_ACCOUNTS,
  createMockOrder,
  createMockQuote,
  MockCryptoService,
  MockPaymentService,
  MockHttpClient,
  delay,
  assertHexAddress,
} from "@ivxp/test-utils";

// Use test wallet accounts (Anvil defaults)
const { address, privateKey } = TEST_ACCOUNTS[0];

// Create fixture data
const order = createMockOrder({ serviceType: "analysis" });
const quote = createMockQuote({ priceUsdc: "5.00" });

// Mock service implementations
const crypto = new MockCryptoService();
const payment = new MockPaymentService();
const http = new MockHttpClient();
```

## Exports

- Test wallet accounts (Anvil defaults)
- Order and service fixture factories
- Mock implementations of all protocol interfaces
- Chain mock utilities for viem/Anvil testing
- Assertion and timing helpers

## License

MIT
