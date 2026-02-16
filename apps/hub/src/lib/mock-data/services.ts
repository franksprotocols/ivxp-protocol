import type { Service } from "@/lib/types/service";

export const MOCK_SERVICES = [
  {
    service_type: "text_echo",
    description:
      "Echo back your text input with optional transformations. Great for testing IVXP protocol integration.",
    price_usdc: "0.50",
    provider_address: "0x1234567890abcdef1234567890abcdef12345678",
    provider_name: "Echo Labs",
    category: "Demo",
  },
  {
    service_type: "image_gen",
    description:
      "Generate high-quality AI images from text prompts using state-of-the-art diffusion models.",
    price_usdc: "1.50",
    provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider_name: "PixelMind AI",
    category: "AI",
  },
  {
    service_type: "sentiment_analysis",
    description:
      "Analyze text sentiment with confidence scores. Supports multiple languages and batch processing.",
    price_usdc: "0.75",
    provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider_name: "PixelMind AI",
    category: "AI",
  },
  {
    service_type: "data_enrichment",
    description:
      "Enrich your datasets with additional context, metadata, and cross-referenced information.",
    price_usdc: "2.00",
    provider_address: "0x9876543210fedcba9876543210fedcba98765432",
    provider_name: "DataFlow Inc",
    category: "Data",
  },
  {
    service_type: "web_scraper",
    description:
      "Extract structured data from web pages with intelligent parsing and rate limiting.",
    price_usdc: "1.00",
    provider_address: "0x9876543210fedcba9876543210fedcba98765432",
    provider_name: "DataFlow Inc",
    category: "Data",
  },
  {
    service_type: "gpu_inference",
    description: "Run ML model inference on high-performance GPU clusters with low latency.",
    price_usdc: "3.00",
    provider_address: "0xfedcba9876543210fedcba9876543210fedcba98",
    provider_name: "ComputeNode",
    category: "Compute",
  },
  {
    service_type: "text_summarizer",
    description: "Summarize long documents into concise key points using advanced NLP techniques.",
    price_usdc: "1.25",
    provider_address: "0x1111222233334444555566667777888899990000",
    provider_name: "SummarizeAI",
    category: "AI",
  },
  {
    service_type: "ping_test",
    description: "Simple ping-pong service for connectivity testing and latency measurement.",
    price_usdc: "0.10",
    provider_address: "0x1234567890abcdef1234567890abcdef12345678",
    provider_name: "Echo Labs",
    category: "Demo",
  },
] as const satisfies readonly Service[];
