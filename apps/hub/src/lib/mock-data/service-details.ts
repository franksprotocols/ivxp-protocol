import type { ServiceDetail } from "@/lib/types/service";

export const MOCK_SERVICE_DETAILS: readonly ServiceDetail[] = [
  {
    service_type: "text_echo",
    description:
      "Echo back your text input with optional transformations. Great for testing IVXP protocol integration.",
    long_description:
      "This service takes your text input and returns it back to you. " +
      "You can optionally apply transformations like uppercase, lowercase, or reverse. " +
      "Perfect for testing the IVXP protocol integration and verifying end-to-end connectivity.",
    price_usdc: "0.50",
    provider_address: "0x1234567890abcdef1234567890abcdef12345678",
    provider_id: "prov-001",
    provider_endpoint_url: "https://echo-labs.ivxp.io",
    provider_name: "Echo Labs",
    provider_reputation: 4.8,
    provider_url: "https://echo-labs.ivxp.io",
    category: "Demo",
    tags: ["text", "echo", "demo", "testing"],
    estimated_time: "< 1 second",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to echo back",
          required: true,
          example: "Hello IVXP!",
        },
        transform: {
          type: "string",
          description: "Optional transformation: uppercase, lowercase, or reverse",
          required: false,
          example: "uppercase",
        },
      },
      required: ["text"],
    },
    output_schema: {
      type: "string",
      format: "text/plain",
      example: "HELLO IVXP!",
    },
    examples: [
      {
        input: { text: "Hello IVXP!", transform: "uppercase" },
        output: "HELLO IVXP!",
        description: "Uppercase transformation",
      },
    ],
  },
  {
    service_type: "text_echo",
    description: "Alternative text echo implementation from PixelMind AI.",
    long_description:
      "PixelMind AI provides a second text echo endpoint for route-collision testing and " +
      "provider selection flows. It mirrors input text and supports the same transform options.",
    price_usdc: "0.55",
    provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider_id: "prov-002",
    provider_endpoint_url: "https://pixelmind.ivxp.io",
    provider_name: "PixelMind AI",
    provider_reputation: 4.6,
    provider_url: "https://pixelmind.ivxp.io",
    category: "Demo",
    tags: ["text", "echo", "demo", "fallback"],
    estimated_time: "< 1 second",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to echo back",
          required: true,
          example: "Hello IVXP!",
        },
        transform: {
          type: "string",
          description: "Optional transformation: uppercase, lowercase, or reverse",
          required: false,
          example: "reverse",
        },
      },
      required: ["text"],
    },
    output_schema: {
      type: "string",
      format: "text/plain",
      example: "!PXVI olleH",
    },
  },
  {
    service_type: "image_gen",
    description:
      "Generate high-quality AI images from text prompts using state-of-the-art diffusion models.",
    long_description:
      "Leverage cutting-edge diffusion models to generate high-quality images from natural language prompts. " +
      "Supports various styles, resolutions, and aspect ratios. Ideal for creative projects, prototyping, and content generation.",
    price_usdc: "1.50",
    provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider_id: "prov-002",
    provider_endpoint_url: "https://pixelmind.ivxp.io",
    provider_name: "PixelMind AI",
    provider_reputation: 4.6,
    provider_url: "https://pixelmind.ivxp.io",
    category: "AI",
    tags: ["image", "ai", "generation", "diffusion"],
    estimated_time: "5-15 seconds",
    input_schema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the image to generate",
          required: true,
          example: "A sunset over mountains in watercolor style",
        },
        width: {
          type: "number",
          description: "Image width in pixels (256-1024)",
          required: false,
          example: 512,
        },
        height: {
          type: "number",
          description: "Image height in pixels (256-1024)",
          required: false,
          example: 512,
        },
      },
      required: ["prompt"],
    },
    output_schema: {
      type: "string",
      format: "image/png (base64)",
      example: "data:image/png;base64,...",
    },
  },
  {
    service_type: "sentiment_analysis",
    description:
      "Analyze text sentiment with confidence scores. Supports multiple languages and batch processing.",
    long_description:
      "Advanced NLP-powered sentiment analysis that returns detailed sentiment scores. " +
      "Supports positive, negative, and neutral classification with confidence percentages. " +
      "Works with multiple languages and can process text in batch mode.",
    price_usdc: "0.75",
    provider_address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider_id: "prov-002",
    provider_endpoint_url: "https://pixelmind.ivxp.io",
    provider_name: "PixelMind AI",
    provider_reputation: 4.6,
    provider_url: "https://pixelmind.ivxp.io",
    category: "AI",
    tags: ["nlp", "sentiment", "ai", "analysis"],
    estimated_time: "1-3 seconds",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to analyze for sentiment",
          required: true,
          example: "I love using the IVXP protocol!",
        },
        language: {
          type: "string",
          description: "ISO 639-1 language code (auto-detected if omitted)",
          required: false,
          example: "en",
        },
      },
      required: ["text"],
    },
    output_schema: {
      type: "object",
      format: "application/json",
      example: '{"sentiment": "positive", "confidence": 0.95}',
    },
  },
  {
    service_type: "data_enrichment",
    description:
      "Enrich your datasets with additional context, metadata, and cross-referenced information.",
    price_usdc: "2.00",
    provider_address: "0x9876543210fedcba9876543210fedcba98765432",
    provider_id: "prov-003",
    provider_endpoint_url: "https://dataflow.ivxp.io",
    provider_name: "DataFlow Inc",
    provider_reputation: 4.3,
    provider_url: "https://dataflow.ivxp.io",
    category: "Data",
    tags: ["data", "enrichment", "metadata"],
    estimated_time: "3-10 seconds",
    input_schema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "The data object to enrich",
          required: true,
          example: { name: "Acme Corp", domain: "acme.com" },
        },
        fields: {
          type: "array",
          description: "Specific fields to enrich (all if omitted)",
          required: false,
          example: ["industry", "employee_count"],
        },
      },
      required: ["data"],
    },
    output_schema: {
      type: "object",
      format: "application/json",
      example: '{"name": "Acme Corp", "industry": "Technology", "employee_count": 500}',
    },
  },
  {
    service_type: "web_scraper",
    description:
      "Extract structured data from web pages with intelligent parsing and rate limiting.",
    price_usdc: "1.00",
    provider_address: "0x9876543210fedcba9876543210fedcba98765432",
    provider_id: "prov-003",
    provider_endpoint_url: "https://dataflow.ivxp.io",
    provider_name: "DataFlow Inc",
    provider_reputation: 4.3,
    category: "Data",
    tags: ["web", "scraping", "data", "extraction"],
    estimated_time: "5-30 seconds",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to scrape",
          required: true,
          example: "https://example.com/products",
        },
        selector: {
          type: "string",
          description: "CSS selector to target specific elements",
          required: false,
          example: ".product-card",
        },
      },
      required: ["url"],
    },
    output_schema: {
      type: "array",
      format: "application/json",
      example: '[{"title": "Product A", "price": "$10"}]',
    },
  },
  {
    service_type: "gpu_inference",
    description: "Run ML model inference on high-performance GPU clusters with low latency.",
    price_usdc: "3.00",
    provider_address: "0xfedcba9876543210fedcba9876543210fedcba98",
    provider_id: "prov-004",
    provider_endpoint_url: "https://computenode.ivxp.io",
    provider_name: "ComputeNode",
    provider_reputation: 4.9,
    category: "Compute",
    tags: ["gpu", "inference", "ml", "compute"],
    estimated_time: "1-60 seconds",
    input_schema: {
      type: "object",
      properties: {
        model_id: {
          type: "string",
          description: "The model identifier to run inference on",
          required: true,
          example: "llama-3-8b",
        },
        input: {
          type: "object",
          description: "Model-specific input payload",
          required: true,
          example: { prompt: "Explain quantum computing" },
        },
      },
      required: ["model_id", "input"],
    },
    output_schema: {
      type: "object",
      format: "application/json",
      example: '{"result": "...", "tokens_used": 150, "latency_ms": 230}',
    },
  },
  {
    service_type: "text_summarizer",
    description: "Summarize long documents into concise key points using advanced NLP techniques.",
    price_usdc: "1.25",
    provider_address: "0x1111222233334444555566667777888899990000",
    provider_id: "prov-005",
    provider_endpoint_url: "https://summarizeai.ivxp.io",
    provider_name: "SummarizeAI",
    provider_reputation: 4.4,
    category: "AI",
    tags: ["nlp", "summarization", "ai", "text"],
    estimated_time: "2-10 seconds",
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to summarize",
          required: true,
          example: "A long article about climate change...",
        },
        max_length: {
          type: "number",
          description: "Maximum summary length in words",
          required: false,
          example: 100,
        },
      },
      required: ["text"],
    },
    output_schema: {
      type: "string",
      format: "text/plain",
      example: "Key points: 1) ... 2) ... 3) ...",
    },
  },
  {
    service_type: "ping_test",
    description: "Simple ping-pong service for connectivity testing and latency measurement.",
    price_usdc: "0.10",
    provider_address: "0x1234567890abcdef1234567890abcdef12345678",
    provider_id: "prov-001",
    provider_endpoint_url: "https://echo-labs.ivxp.io",
    provider_name: "Echo Labs",
    provider_reputation: 4.8,
    category: "Demo",
    tags: ["ping", "test", "demo", "connectivity"],
    estimated_time: "< 1 second",
    input_schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Optional message to include in the ping",
          required: false,
          example: "ping",
        },
      },
    },
    output_schema: {
      type: "string",
      format: "text/plain",
      example: "pong",
    },
  },
] as const satisfies readonly ServiceDetail[];
