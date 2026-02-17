/**
 * Image Generation service handler for the IVXP Demo Provider.
 *
 * Generates a placeholder SVG image based on the client's prompt text.
 * No external dependencies required -- uses inline SVG generation for
 * reliability and fast execution in demo scenarios.
 *
 * XSS Protection: All user input is escaped via escapeXml() before
 * embedding in SVG to prevent script injection attacks.
 *
 * Input: The order description (used as the image prompt text).
 * Output: SVG image content with the prompt text rendered.
 */

import type { ServiceResult } from "./types.js";
import { computeContentHash } from "./content-hash.js";

/** Default image dimensions. */
const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 512;

/** Maximum prompt length for the SVG text. */
const MAX_PROMPT_LENGTH = 200;

/** Maximum display length for prompt text in SVG (with ellipsis). */
const MAX_DISPLAY_PROMPT_LENGTH = 60;

/** Maximum display length for order ID in SVG (with ellipsis). */
const MAX_DISPLAY_ORDER_ID_LENGTH = 20;

/** Regex for valid IVXP order IDs: ivxp-{uuid-v4}. */
const ORDER_ID_REGEX =
  /^ivxp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Escape special XML characters in a string for safe SVG embedding.
 *
 * Prevents XSS attacks by converting special characters to XML entities.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Truncate text to fit within the SVG, adding ellipsis if needed.
 */
function truncateForDisplay(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Generate a placeholder SVG image with the given prompt text.
 *
 * The SVG includes:
 * - A gradient background
 * - The IVXP branding
 * - The prompt text (escaped and truncated if too long)
 * - The order ID (escaped and truncated)
 * - A timestamp (escaped)
 *
 * All user-provided content is escaped to prevent XSS attacks.
 */
function generatePlaceholderSvg(
  prompt: string,
  orderId: string,
  width: number,
  height: number,
): string {
  // Escape THEN truncate to ensure no XSS via truncation boundary
  const displayPrompt = truncateForDisplay(escapeXml(prompt), MAX_DISPLAY_PROMPT_LENGTH);
  const shortOrderId =
    orderId.length > MAX_DISPLAY_ORDER_ID_LENGTH
      ? `${orderId.slice(0, MAX_DISPLAY_ORDER_ID_LENGTH)}...`
      : orderId;
  const timestamp = new Date().toISOString();

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    "  <defs>",
    `    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />`,
    `      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />`,
    "    </linearGradient>",
    "  </defs>",
    `  <rect width="${width}" height="${height}" fill="url(#bg)" />`,
    `  <text x="${width / 2}" y="${height / 2 - 40}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="24" font-weight="bold">`,
    "    IVXP Demo Image",
    "  </text>",
    `  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-family="sans-serif" font-size="16">`,
    `    ${displayPrompt}`,
    "  </text>",
    `  <text x="${width / 2}" y="${height / 2 + 40}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-family="monospace" font-size="12">`,
    `    ${escapeXml(shortOrderId)}`,
    "  </text>",
    `  <text x="${width / 2}" y="${height - 20}" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="10">`,
    `    ${escapeXml(timestamp)}`,
    "  </text>",
    "</svg>",
  ].join("\n");
}

/**
 * Execute the image_gen service.
 *
 * @param orderId - The unique order identifier
 * @param description - The prompt text for the image
 * @returns ServiceResult with SVG image content
 * @throws Error if orderId format is invalid
 * @throws Error if description is empty or exceeds max length
 */
export async function executeImageGen(
  orderId: string,
  description: string,
): Promise<ServiceResult> {
  // Validate orderId format
  if (!orderId || typeof orderId !== "string") {
    throw new Error("Invalid input: orderId is required and must be a string");
  }

  if (!ORDER_ID_REGEX.test(orderId)) {
    throw new Error(`Invalid input: orderId must match format ivxp-{uuid-v4}, got: ${orderId}`);
  }

  // Validate description
  if (!description || typeof description !== "string") {
    throw new Error("Invalid input: description is required and must be a string");
  }

  if (description.trim().length === 0) {
    throw new Error("Invalid input: description cannot be empty or whitespace-only");
  }

  if (description.length > MAX_PROMPT_LENGTH) {
    throw new Error(
      `Invalid input: description exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
    );
  }

  const svg = generatePlaceholderSvg(description, orderId, DEFAULT_WIDTH, DEFAULT_HEIGHT);

  const contentHash = computeContentHash(svg);

  return {
    content: svg,
    contentType: "image/svg+xml",
    contentHash,
    metadata: {
      service_type: "image_gen",
      prompt: description,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      order_id: orderId,
      format: "svg",
      timestamp: new Date().toISOString(),
    },
  };
}
