import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";

const WORKFLOWS_DIR = resolve(__dirname, "../../.github/workflows");
const GITHUB_DIR = resolve(__dirname, "../../.github");
const ROOT_DIR = resolve(__dirname, "../..");

interface WorkflowJob {
  readonly name?: string;
  readonly "runs-on"?: string;
  readonly needs?: string | readonly string[];
  readonly steps?: readonly Record<string, unknown>[];
  readonly "timeout-minutes"?: number;
  readonly if?: string;
  readonly outputs?: Record<string, string>;
  readonly permissions?: Record<string, string>;
}

interface Workflow {
  readonly name: string;
  readonly on: Record<string, unknown>;
  readonly jobs: Record<string, WorkflowJob>;
  readonly concurrency?: Record<string, unknown>;
  readonly permissions?: Record<string, string>;
}

function loadWorkflow(filename: string): Workflow {
  const filepath = resolve(WORKFLOWS_DIR, filename);
  const content = readFileSync(filepath, "utf-8");
  return yaml.load(content) as Workflow;
}

describe("CI/CD Workflow Validation", () => {
  describe("File existence", () => {
    const requiredFiles = [
      ".github/workflows/ci.yml",
      ".github/workflows/release.yml",
      ".github/workflows/deploy-hub.yml",
      ".github/workflows/deploy-provider.yml",
      ".github/workflows/nightly.yml",
      ".github/CODEOWNERS",
      ".github/dependabot.yml",
      ".nvmrc",
    ];

    it.each(requiredFiles)("should have %s", (file) => {
      const filepath = resolve(ROOT_DIR, file);
      expect(existsSync(filepath)).toBe(true);
    });
  });

  describe("CI workflow (ci.yml)", () => {
    let ci: Workflow;

    beforeAll(() => {
      ci = loadWorkflow("ci.yml");
    });

    it("should trigger on pull_request and push to main", () => {
      expect(ci.on).toHaveProperty("pull_request");
      expect(ci.on).toHaveProperty("push");
    });

    it("should have lint, typecheck, test, and integration jobs", () => {
      expect(ci.jobs).toHaveProperty("lint");
      expect(ci.jobs).toHaveProperty("typecheck");
      expect(ci.jobs).toHaveProperty("test");
      expect(ci.jobs).toHaveProperty("integration");
    });

    it("should have a ci-status aggregation job", () => {
      expect(ci.jobs).toHaveProperty("ci-status");
      const statusJob = ci.jobs["ci-status"];
      const needs = statusJob.needs as readonly string[];
      expect(needs).toContain("lint");
      expect(needs).toContain("typecheck");
      expect(needs).toContain("test");
    });

    it("should use pnpm and Node 20 in all jobs", () => {
      for (const [, job] of Object.entries(ci.jobs)) {
        if (!job.steps) continue;
        const usesSetupNode = job.steps.some(
          (s) => typeof s.uses === "string" && s.uses.startsWith("actions/setup-node@"),
        );
        const usesPnpm = job.steps.some(
          (s) => typeof s.uses === "string" && s.uses.startsWith("pnpm/action-setup@"),
        );
        if (usesSetupNode) {
          expect(usesPnpm).toBe(true);
        }
      }
    });

    it("should have concurrency settings", () => {
      expect(ci.concurrency).toBeDefined();
      expect(ci.concurrency?.["cancel-in-progress"]).toBe(true);
    });

    it("should run integration tests only on push to main", () => {
      const integrationJob = ci.jobs.integration;
      expect(integrationJob.if).toContain("push");
      expect(integrationJob.if).toContain("refs/heads/main");
    });

    it("should upload coverage to Codecov", () => {
      const testJob = ci.jobs.test;
      const codecovStep = testJob.steps?.find(
        (s) => typeof s.uses === "string" && s.uses.startsWith("codecov/codecov-action@"),
      );
      expect(codecovStep).toBeDefined();
    });
  });

  describe("Release workflow (release.yml)", () => {
    let release: Workflow;

    beforeAll(() => {
      release = loadWorkflow("release.yml");
    });

    it("should trigger on version tags (v*)", () => {
      const pushTrigger = release.on.push as Record<string, unknown>;
      const tags = pushTrigger.tags as readonly string[];
      expect(tags).toContain("v*");
    });

    it("should have validate, build-and-test, publish-npm, and create-release jobs", () => {
      expect(release.jobs).toHaveProperty("validate");
      expect(release.jobs).toHaveProperty("build-and-test");
      expect(release.jobs).toHaveProperty("publish-npm");
      expect(release.jobs).toHaveProperty("create-release");
    });

    it("should have correct job dependency chain", () => {
      expect(release.jobs["build-and-test"].needs).toContain("validate");
      const publishNeeds = release.jobs["publish-npm"].needs as readonly string[];
      expect(publishNeeds).toContain("validate");
      expect(publishNeeds).toContain("build-and-test");
      const releaseNeeds = release.jobs["create-release"].needs as readonly string[];
      expect(releaseNeeds).toContain("validate");
      expect(releaseNeeds).toContain("publish-npm");
    });

    it("should have write permissions for contents and id-token", () => {
      expect(release.permissions?.contents).toBe("write");
      expect(release.permissions?.["id-token"]).toBe("write");
    });

    it("should validate version synchronization", () => {
      const validateSteps = release.jobs.validate.steps ?? [];
      const versionStep = validateSteps.find(
        (s) => typeof s.name === "string" && s.name.toLowerCase().includes("version"),
      );
      expect(versionStep).toBeDefined();
    });

    it("should publish packages sequentially (protocol -> test-utils -> sdk)", () => {
      const publishSteps = release.jobs["publish-npm"].steps ?? [];
      const publishNames = publishSteps
        .filter((s) => typeof s.name === "string" && s.name.startsWith("Publish @ivxp/"))
        .map((s) => s.name as string);
      expect(publishNames).toEqual([
        "Publish @ivxp/protocol",
        "Publish @ivxp/test-utils",
        "Publish @ivxp/sdk",
      ]);
    });
  });

  describe("Deploy Hub workflow (deploy-hub.yml)", () => {
    let deployHub: Workflow;

    beforeAll(() => {
      deployHub = loadWorkflow("deploy-hub.yml");
    });

    it("should trigger after Release workflow completes", () => {
      expect(deployHub.on).toHaveProperty("workflow_run");
    });

    it("should support manual dispatch", () => {
      expect(deployHub.on).toHaveProperty("workflow_dispatch");
    });

    it("should deploy to Vercel", () => {
      const deployJob = deployHub.jobs.deploy;
      const vercelStep = deployJob.steps?.find(
        (s) => typeof s.uses === "string" && s.uses.includes("vercel-action"),
      );
      expect(vercelStep).toBeDefined();
    });

    it("should have a health check step", () => {
      const deployJob = deployHub.jobs.deploy;
      const healthStep = deployJob.steps?.find(
        (s) => typeof s.name === "string" && s.name.toLowerCase().includes("health"),
      );
      expect(healthStep).toBeDefined();
    });
  });

  describe("Deploy Provider workflow (deploy-provider.yml)", () => {
    let deployProvider: Workflow;

    beforeAll(() => {
      deployProvider = loadWorkflow("deploy-provider.yml");
    });

    it("should trigger after Release workflow completes", () => {
      expect(deployProvider.on).toHaveProperty("workflow_run");
    });

    it("should support manual dispatch", () => {
      expect(deployProvider.on).toHaveProperty("workflow_dispatch");
    });

    it("should deploy to Railway", () => {
      const deployJob = deployProvider.jobs.deploy;
      const railwayStep = deployJob.steps?.find(
        (s) => typeof s.run === "string" && s.run.includes("railway"),
      );
      expect(railwayStep).toBeDefined();
    });
  });

  describe("Nightly workflow (nightly.yml)", () => {
    let nightly: Workflow;

    beforeAll(() => {
      nightly = loadWorkflow("nightly.yml");
    });

    it("should trigger on schedule", () => {
      expect(nightly.on).toHaveProperty("schedule");
    });

    it("should support manual dispatch", () => {
      expect(nightly.on).toHaveProperty("workflow_dispatch");
    });

    it("should run integration tests with Anvil", () => {
      const integrationJob = nightly.jobs.integration;
      const anvilStep = integrationJob.steps?.find(
        (s) =>
          typeof s.uses === "string" &&
          (s.uses.includes("foundry-toolchain") || s.uses.includes("setup-anvil")),
      );
      expect(anvilStep).toBeDefined();
    });

    it("should audit dependencies", () => {
      const integrationJob = nightly.jobs.integration;
      const auditStep = integrationJob.steps?.find(
        (s) => typeof s.run === "string" && s.run.includes("pnpm audit"),
      );
      expect(auditStep).toBeDefined();
    });
  });

  describe("Quality gates", () => {
    it("should have CODEOWNERS file with default owner", () => {
      const content = readFileSync(resolve(GITHUB_DIR, "CODEOWNERS"), "utf-8");
      expect(content).toContain("*");
      expect(content).toContain("@");
    });

    it("should have dependabot.yml with npm and github-actions ecosystems", () => {
      const content = readFileSync(resolve(GITHUB_DIR, "dependabot.yml"), "utf-8");
      const config = yaml.load(content) as Record<string, unknown>;
      const updates = config.updates as readonly Record<string, unknown>[];
      const ecosystems = updates.map((u) => u["package-ecosystem"]);
      expect(ecosystems).toContain("npm");
      expect(ecosystems).toContain("github-actions");
    });

    it("should have .nvmrc with Node 20", () => {
      const content = readFileSync(resolve(ROOT_DIR, ".nvmrc"), "utf-8");
      expect(content.trim()).toBe("20");
    });

    it("should have .npmrc with registry configured", () => {
      const content = readFileSync(resolve(ROOT_DIR, ".npmrc"), "utf-8");
      expect(content).toContain("registry=https://registry.npmjs.org/");
    });
  });

  describe("Workflow best practices", () => {
    const workflowFiles = [
      "ci.yml",
      "release.yml",
      "deploy-hub.yml",
      "deploy-provider.yml",
      "nightly.yml",
    ];

    it.each(workflowFiles)("%s should use actions/checkout@v4", (filename) => {
      const workflow = loadWorkflow(filename);
      for (const [, job] of Object.entries(workflow.jobs)) {
        if (!job.steps) continue;
        const checkoutStep = job.steps.find(
          (s) => typeof s.uses === "string" && s.uses.startsWith("actions/checkout@"),
        );
        if (checkoutStep) {
          expect(checkoutStep.uses).toBe("actions/checkout@v4");
        }
      }
    });

    it.each(workflowFiles)("%s should have timeout-minutes on all jobs", (filename) => {
      const workflow = loadWorkflow(filename);
      for (const [jobName, job] of Object.entries(workflow.jobs)) {
        if (jobName === "ci-status") continue;
        expect(
          job["timeout-minutes"],
          `Job ${jobName} in ${filename} should have timeout-minutes`,
        ).toBeDefined();
      }
    });

    it.each(workflowFiles)("%s should use frozen-lockfile for pnpm install", (filename) => {
      const workflow = loadWorkflow(filename);
      for (const [, job] of Object.entries(workflow.jobs)) {
        if (!job.steps) continue;
        for (const step of job.steps) {
          if (typeof step.run === "string" && step.run.includes("pnpm install")) {
            expect(step.run).toContain("--frozen-lockfile");
          }
        }
      }
    });
  });
});
