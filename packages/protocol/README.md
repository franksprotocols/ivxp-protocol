# @ivxp/protocol

Core types, Zod validation schemas, and constants for the Intelligence Value Exchange Protocol (IVXP/1.0).

## Install

```bash
npm install @ivxp/protocol
```

## Usage

```typescript
import {
  PROTOCOL_VERSION,
  ORDER_STATUSES,
  USDC_CONTRACT_ADDRESSES,
  ServiceRequestSchema,
  ServiceQuoteSchema,
} from '@ivxp/protocol';

// Validate incoming service request
const result = ServiceRequestSchema.safeParse(incomingData);
if (!result.success) {
  console.error('Invalid request:', result.error);
}

// Type-safe protocol constants
console.log(PROTOCOL_VERSION); // "IVXP/1.0"
```

## Exports

- Protocol type definitions (ServiceRequest, ServiceQuote, OrderStatus, etc.)
- Zod validation schemas for all message types
- Contract interface types (ICryptoService, IPaymentService, IHttpClient, etc.)
- Constants (PROTOCOL_VERSION, ORDER_STATUSES, USDC_CONTRACT_ADDRESSES)

## License

MIT
