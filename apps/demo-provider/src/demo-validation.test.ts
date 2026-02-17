/**
 * E2E Demo Script Validation Tests
 *
 * Validates that all demo artifacts exist, are well-structured,
 * and cover the required acceptance criteria:
 * - Evaluator can complete full demo in under 10 minutes
 * - Demo covers all major protocol features
 * - Instructions are clear and easy to follow
 * - Demo works reliably on Base Sepolia testnet
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const DEMO_README = resolve(ROOT, "docs/demo/README.md");
const SETUP_SCRIPT = resolve(ROOT, "scripts/setup-demo.sh");
const HEALTH_SCRIPT = resolve(ROOT, "scripts/health-check.sh");

describe("Demo Documentation", () => {
  it("docs/demo/README.md exists", () => {
    expect(existsSync(DEMO_README)).toBe(true);
  });

  it("README.md is non-empty", () => {
    const stat = statSync(DEMO_README);
    expect(stat.size).toBeGreaterThan(1000);
  });

  describe("covers all major protocol features (AC #2)", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(DEMO_README, "utf-8");
    });

    it("includes wallet connectivity section", () => {
      expect(content).toMatch(/[Cc]onnect.*[Ww]allet/);
    });

    it("includes marketplace/browse services section", () => {
      expect(content).toMatch(/[Mm]arketplace|[Bb]rowse.*[Ss]ervice/);
    });

    it("includes purchase/payment flow", () => {
      expect(content).toMatch(/[Pp]urchase|[Pp]ay.*USDC/);
    });

    it("covers text_echo service", () => {
      expect(content).toMatch(/[Tt]ext.*[Ee]cho/);
    });

    it("covers image_gen service", () => {
      expect(content).toMatch(/[Ii]mage.*[Gg]en/);
    });

    it("includes Protocol Inspector section", () => {
      expect(content).toMatch(/[Pp]rotocol.*[Ii]nspector/);
    });

    it("mentions EIP-191 signature verification", () => {
      expect(content).toMatch(/EIP-191/);
    });

    it("mentions content hash verification", () => {
      expect(content).toMatch(/content.hash/i);
    });

    it("mentions state machine transitions", () => {
      expect(content).toMatch(/quoted.*paid.*processing.*delivered/i);
    });

    it("references Base Sepolia testnet", () => {
      expect(content).toMatch(/Base Sepolia/);
    });
  });

  describe("instructions are clear and easy to follow (AC #3)", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(DEMO_README, "utf-8");
    });

    it("has numbered steps", () => {
      const numberedSteps = content.match(/^\d+\./gm);
      expect(numberedSteps).not.toBeNull();
      expect(numberedSteps!.length).toBeGreaterThan(10);
    });

    it("includes time estimates for each part", () => {
      expect(content).toMatch(/\d+\s*minutes?/i);
      expect(content).toMatch(/\d+\s*seconds?/i);
    });

    it("has prerequisites checklist", () => {
      expect(content).toMatch(/\[.\]\s/);
    });

    it("includes faucet links", () => {
      expect(content).toMatch(/alchemy\.com.*faucet/i);
      expect(content).toMatch(/faucet\.circle\.com/i);
    });

    it("has troubleshooting section", () => {
      expect(content).toMatch(/[Tt]roubleshooting/);
    });

    it("has quick reference section", () => {
      expect(content).toMatch(/[Qq]uick.*[Rr]eference/);
    });
  });

  describe("evaluator can complete in under 10 minutes (AC #1)", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(DEMO_README, "utf-8");
    });

    it("mentions 10-minute target in title or intro", () => {
      expect(content).toMatch(/10.*[Mm]inute/);
    });

    it("has 4 parts with time allocations", () => {
      expect(content).toMatch(/Part 1.*2 minutes/i);
      expect(content).toMatch(/Part 2.*2 minutes/i);
      expect(content).toMatch(/Part 3.*4 minutes/i);
      expect(content).toMatch(/Part 4.*2 minutes/i);
    });

    it("includes skip-to sections for experienced users", () => {
      expect(content).toMatch(/[Ss]kip/);
    });
  });

  describe("demo works reliably on Base Sepolia (AC #4)", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(DEMO_README, "utf-8");
    });

    it("includes Base Sepolia chain ID", () => {
      expect(content).toMatch(/84532/);
    });

    it("includes Base Sepolia RPC URL", () => {
      expect(content).toMatch(/sepolia\.base\.org/);
    });

    it("includes USDC contract address", () => {
      expect(content).toMatch(/0x036CbD53842c5426634e7929541eC2318f3dCF7e/i);
    });

    it("includes BaseScan explorer reference", () => {
      expect(content).toMatch(/basescan/i);
    });

    it("documents network switching", () => {
      expect(content).toMatch(/[Ss]witch.*[Nn]etwork|[Ww]rong.*[Nn]etwork/);
    });
  });
});

describe("Setup Script", () => {
  it("scripts/setup-demo.sh exists", () => {
    expect(existsSync(SETUP_SCRIPT)).toBe(true);
  });

  it("is executable", () => {
    const stat = statSync(SETUP_SCRIPT);
    const isExecutable = (stat.mode & 0o111) !== 0;
    expect(isExecutable).toBe(true);
  });

  describe("script content validation", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(SETUP_SCRIPT, "utf-8");
    });

    it("has shebang line", () => {
      expect(content).toMatch(/^#!\/bin\/bash/);
    });

    it("uses strict mode (set -e)", () => {
      expect(content).toMatch(/set -e/);
    });

    it("checks for node prerequisite", () => {
      expect(content).toMatch(/command -v node/);
    });

    it("checks for pnpm prerequisite", () => {
      expect(content).toMatch(/command -v pnpm/);
    });

    it("installs dependencies", () => {
      expect(content).toMatch(/pnpm install/);
    });

    it("builds protocol package", () => {
      expect(content).toMatch(/protocol.*build|build.*protocol/i);
    });

    it("builds SDK package", () => {
      expect(content).toMatch(/sdk.*build|build.*sdk/i);
    });

    it("builds demo-provider", () => {
      expect(content).toMatch(/demo-provider.*build|build.*demo-provider/i);
    });

    it("builds hub", () => {
      expect(content).toMatch(/hub.*build|build.*hub/i);
    });

    it("references health check", () => {
      expect(content).toMatch(/health-check/);
    });

    it("supports --help flag", () => {
      expect(content).toMatch(/--help/);
    });
  });
});

describe("Health Check Script", () => {
  it("scripts/health-check.sh exists", () => {
    expect(existsSync(HEALTH_SCRIPT)).toBe(true);
  });

  it("is executable", () => {
    const stat = statSync(HEALTH_SCRIPT);
    const isExecutable = (stat.mode & 0o111) !== 0;
    expect(isExecutable).toBe(true);
  });

  describe("script content validation", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(HEALTH_SCRIPT, "utf-8");
    });

    it("has shebang line", () => {
      expect(content).toMatch(/^#!\/bin\/bash/);
    });

    it("uses strict mode (set -e)", () => {
      expect(content).toMatch(/set -e/);
    });

    it("checks provider health endpoint", () => {
      expect(content).toMatch(/\/health/);
    });

    it("checks provider catalog endpoint", () => {
      expect(content).toMatch(/\/ivxp\/catalog/);
    });

    it("checks hub endpoints", () => {
      expect(content).toMatch(/Hub|hub/);
    });

    it("supports --local flag", () => {
      expect(content).toMatch(/--local/);
    });

    it("supports custom provider URL", () => {
      expect(content).toMatch(/--provider-url/);
    });

    it("reports pass/fail summary", () => {
      expect(content).toMatch(/passed|PASS/);
      expect(content).toMatch(/failed|FAIL/);
    });
  });
});

describe("Demo screenshots directory", () => {
  it("docs/demo/screenshots/ directory exists", () => {
    const dir = resolve(ROOT, "docs/demo/screenshots");
    expect(existsSync(dir)).toBe(true);
  });
});
