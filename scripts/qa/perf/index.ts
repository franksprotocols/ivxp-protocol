/**
 * Performance Benchmark Suite -- barrel export
 * Story 8.9: Performance Benchmark & Validation
 */

export {
  type BenchmarkResult,
  type BenchmarkSummary,
  PERFORMANCE_TARGETS,
  API_ENDPOINTS,
  percentile,
  simulateBenchmark,
  runApiBenchmarkSuite,
  formatBenchmarkTable,
} from "./api-benchmark.js";

export {
  type PaymentTimingResult,
  type PaymentBenchmarkSummary,
  type TimingStats,
  PAYMENT_TARGETS,
  computeStats,
  simulatePaymentIteration,
  runPaymentBenchmarkSuite,
  formatPaymentTable,
} from "./payment-benchmark.js";

export {
  type SDKTimingStep,
  type SDKIntegrationResult,
  type SDKBenchmarkSummary,
  SDK_TARGETS,
  INTEGRATION_STEPS,
  simulateSDKIntegration,
  runSDKBenchmarkSuite,
  formatSDKTable,
} from "./sdk-integration-benchmark.js";

export {
  type LighthousePageResult,
  type LighthouseSummary,
  LIGHTHOUSE_TARGETS,
  HUB_PAGES,
  simulateLighthouseAudit,
  identifyOptimizations,
  runLighthouseSuite,
  formatLighthouseTable,
} from "./lighthouse-benchmark.js";
