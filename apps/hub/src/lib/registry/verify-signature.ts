import { recoverMessageAddress } from "viem";

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify that an EIP-191 signature was produced by the claimed address.
 * Also validates the timestamp to prevent replay attacks (±5 minute window).
 *
 * @returns true if the recovered signer matches the expected address and timestamp is valid
 */
export async function verifyRegistrationSignature(params: {
  message: string;
  signature: `0x${string}`;
  expectedAddress: `0x${string}`;
}): Promise<boolean> {
  try {
    // Validate timestamp to prevent replay attacks
    const timestampMatch = params.message.match(/Timestamp: (.+)$/m);
    if (!timestampMatch) {
      // eslint-disable-next-line no-console
      console.warn("Registration signature verification failed: missing timestamp");
      return false;
    }

    const timestamp = new Date(timestampMatch[1]);
    if (isNaN(timestamp.getTime())) {
      // eslint-disable-next-line no-console
      console.warn("Registration signature verification failed: invalid timestamp format");
      return false;
    }

    const now = Date.now();
    const timeDiff = Math.abs(now - timestamp.getTime());
    if (timeDiff > TIMESTAMP_TOLERANCE_MS) {
      // eslint-disable-next-line no-console
      console.warn(
        `Registration signature verification failed: timestamp outside tolerance window (${timeDiff}ms)`,
      );
      return false;
    }

    const recoveredAddress = await recoverMessageAddress({
      message: params.message,
      signature: params.signature,
    });

    // Case-insensitive comparison (Ethereum addresses are case-insensitive)
    return recoveredAddress.toLowerCase() === params.expectedAddress.toLowerCase();
  } catch (error) {
    // Invalid signature format - return false, don't throw
    // eslint-disable-next-line no-console
    console.warn("Registration signature verification failed:", error);
    return false;
  }
}

/**
 * Build the canonical registration message that the provider must sign.
 */
export function buildRegistrationMessage(params: {
  providerAddress: string;
  name: string;
  endpointUrl: string;
  timestamp: string;
}): string {
  return [
    "IVXP Provider Registration",
    `Address: ${params.providerAddress}`,
    `Name: ${params.name}`,
    `Endpoint: ${params.endpointUrl}`,
    `Timestamp: ${params.timestamp}`,
  ].join("\n");
}

/**
 * Parse and validate the registration message format.
 * Returns the parsed fields if valid, null otherwise.
 */
export function parseRegistrationMessage(message: string): {
  providerAddress: string;
  name: string;
  endpointUrl: string;
  timestamp: string;
} | null {
  const lines = message.split("\n");
  if (lines.length !== 5) {
    return null;
  }

  if (lines[0] !== "IVXP Provider Registration") {
    return null;
  }

  const addressMatch = lines[1].match(/^Address: (.+)$/);
  const nameMatch = lines[2].match(/^Name: (.+)$/);
  const endpointMatch = lines[3].match(/^Endpoint: (.+)$/);
  const timestampMatch = lines[4].match(/^Timestamp: (.+)$/);

  if (!addressMatch || !nameMatch || !endpointMatch || !timestampMatch) {
    return null;
  }

  return {
    providerAddress: addressMatch[1],
    name: nameMatch[1],
    endpointUrl: endpointMatch[1],
    timestamp: timestampMatch[1],
  };
}
