/**
 * Basic Client Example
 *
 * Demonstrates the one-line requestService() convenience method
 * for requesting a service from an IVXP provider.
 *
 * Usage:
 *   IVXP_PRIVATE_KEY=0x... npx tsx docs/sdk/examples/basic-client.ts
 */

import { createIVXPClient, type RequestServiceResult } from '@ivxp/sdk';

async function main(): Promise<void> {
  const privateKey = process.env.IVXP_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error('IVXP_PRIVATE_KEY environment variable is required');
  }

  const providerUrl = process.env.IVXP_PROVIDER_URL ?? 'http://localhost:3001';

  // Create client
  const client = createIVXPClient({
    privateKey,
    network: 'base-sepolia',
  });

  console.log('Client address:', await client.getAddress());
  console.log('Network:', client.getNetwork());

  // One-line service call
  const result: RequestServiceResult = await client.requestService({
    providerUrl,
    serviceType: 'text_echo',
    description: 'Echo back: Hello IVXP!',
    budgetUsdc: 1,
    onQuote: (quote) => console.log('Quote received:', quote.orderId),
    onPayment: (payment) => console.log('Payment sent:', payment.txHash),
    onDelivered: () => console.log('Delivered!'),
    onConfirmed: (confirm) => console.log('Confirmed at:', confirm.confirmedAt),
  });

  console.log('Result:', {
    orderId: result.orderId,
    status: result.status,
    paymentTxHash: result.paymentTxHash,
  });
}

main().catch(console.error);
