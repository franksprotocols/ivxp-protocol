import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";

const ROOT_DIR = resolve(__dirname, "../..");
const SCRIPTS_DIR = resolve(__dirname, "..");

// ── Helper: read a script file ─────────────────────────────────────
function readScript(relativePath: string): string {
  const fullPath = resolve(SCRIPTS_DIR, relativePath);
  return readFileSync(fullPath, "utf-8");
}

function scriptExists(relativePath: string): boolean {
  return existsSync(resolve(SCRIPTS_DIR, relativePath));
}

function isExecutable(relativePath: string): boolean {
  const fullPath = resolve(SCRIPTS_DIR, relativePath);
  try {
    const stats = statSync(fullPath);
    // Check owner execute bit (0o100)
    return (stats.mode & 0o100) !== 0;
  } catch {
    return false;
  }
}

// ── Helper: run a script with --help and capture output ────────────
function runHelp(relativePath: string): string {
  const fullPath = resolve(SCRIPTS_DIR, relativePath);
  try {
    return execSync(`bash "${fullPath}" --help 2>&1`, {
      timeout: 5000,
      encoding: "utf-8",
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return execError.stdout || execError.stderr || "";
  }
}

// ── Helper: syntax-check a bash script ─────────────────────────────
function bashSyntaxCheck(relativePath: string): boolean {
  const fullPath = resolve(SCRIPTS_DIR, relativePath);
  try {
    execSync(`bash -n "${fullPath}" 2>&1`, {
      timeout: 5000,
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}

// ── All expected scripts ───────────────────────────────────────────
const EXPECTED_SCRIPTS = [
  "deploy/deploy-hub.sh",
  "deploy/deploy-provider.sh",
  "deploy/setup-env.sh",
  "deploy/rollback.sh",
  "health/check-hub.sh",
  "health/check-provider.sh",
  "db/init-provider-db.sh",
  "db/backup-db.sh",
  "utils/common.sh",
  "utils/verify-build.sh",
  "utils/monitor-deployment.sh",
] as const;

// ════════════════════════════════════════════════════════════════════
// Test Suite: Script File Structure
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: File Structure", () => {
  it.each(EXPECTED_SCRIPTS)("script exists: %s", (script) => {
    expect(scriptExists(script)).toBe(true);
  });

  it.each(EXPECTED_SCRIPTS)("script is executable: %s", (script) => {
    expect(isExecutable(script)).toBe(true);
  });

  it.each(EXPECTED_SCRIPTS)("script has valid bash syntax: %s", (script) => {
    expect(bashSyntaxCheck(script)).toBe(true);
  });

  it.each(EXPECTED_SCRIPTS)("script starts with shebang: %s", (script) => {
    const content = readScript(script);
    expect(content.startsWith("#!/bin/bash")).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: common.sh Utilities
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: common.sh", () => {
  const content = readScript("utils/common.sh");

  it("sets strict mode (set -euo pipefail)", () => {
    expect(content).toContain("set -euo pipefail");
  });

  it("defines color variables", () => {
    expect(content).toContain("RED=");
    expect(content).toContain("GREEN=");
    expect(content).toContain("NC=");
  });

  it("exports logging functions", () => {
    expect(content).toContain("log_info()");
    expect(content).toContain("log_success()");
    expect(content).toContain("log_warn()");
    expect(content).toContain("log_error()");
  });

  it("exports prerequisite check functions", () => {
    expect(content).toContain("require_command()");
    expect(content).toContain("require_file()");
    expect(content).toContain("require_env_var()");
  });

  it("exports HTTP helper functions", () => {
    expect(content).toContain("http_status()");
    expect(content).toContain("wait_for_url()");
  });

  it("exports project root detection", () => {
    expect(content).toContain("find_project_root()");
  });

  it("supports DRY_RUN mode", () => {
    expect(content).toContain("DRY_RUN");
    expect(content).toContain("run_cmd()");
  });

  it("disables colors when not a terminal", () => {
    expect(content).toContain("[ -t 1 ]");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: deploy-hub.sh
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: deploy-hub.sh", () => {
  const content = readScript("deploy/deploy-hub.sh");

  it("sources common.sh", () => {
    expect(content).toContain("source");
    expect(content).toContain("common.sh");
  });

  it("requires vercel CLI", () => {
    expect(content).toContain("require_command");
    expect(content).toContain("vercel");
  });

  it("requires VERCEL_TOKEN", () => {
    expect(content).toContain("VERCEL_TOKEN");
  });

  it("requires VERCEL_ORG_ID", () => {
    expect(content).toContain("VERCEL_ORG_ID");
  });

  it("requires VERCEL_PROJECT_ID", () => {
    expect(content).toContain("VERCEL_PROJECT_ID");
  });

  it("supports --prod and --preview flags", () => {
    expect(content).toContain("--prod");
    expect(content).toContain("--preview");
  });

  it("supports --skip-build flag", () => {
    expect(content).toContain("--skip-build");
  });

  it("runs build verification by default", () => {
    expect(content).toContain("verify-build.sh");
  });

  it("performs post-deploy health check", () => {
    expect(content).toContain("wait_for_url");
  });

  it("shows help with --help flag", () => {
    const help = runHelp("deploy/deploy-hub.sh");
    expect(help).toContain("Usage");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: deploy-provider.sh
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: deploy-provider.sh", () => {
  const content = readScript("deploy/deploy-provider.sh");

  it("sources common.sh", () => {
    expect(content).toContain("common.sh");
  });

  it("requires railway CLI", () => {
    expect(content).toContain("require_command");
    expect(content).toContain("railway");
  });

  it("requires RAILWAY_TOKEN", () => {
    expect(content).toContain("RAILWAY_TOKEN");
  });

  it("supports --skip-build flag", () => {
    expect(content).toContain("--skip-build");
  });

  it("supports --skip-migrate flag", () => {
    expect(content).toContain("--skip-migrate");
  });

  it("runs database initialization", () => {
    expect(content).toContain("init-provider-db.sh");
  });

  it("performs post-deploy health check", () => {
    expect(content).toContain("wait_for_url");
    expect(content).toContain("/health");
  });

  it("shows help with --help flag", () => {
    const help = runHelp("deploy/deploy-provider.sh");
    expect(help).toContain("Usage");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: setup-env.sh
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: setup-env.sh", () => {
  const content = readScript("deploy/setup-env.sh");

  it("supports --validate flag", () => {
    expect(content).toContain("--validate");
  });

  it("supports --env flag", () => {
    expect(content).toContain("--env=");
  });

  it("validates hub required variables", () => {
    expect(content).toContain("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
    expect(content).toContain("NEXT_PUBLIC_DEMO_PROVIDER_URL");
  });

  it("validates provider required variables", () => {
    expect(content).toContain("PROVIDER_PRIVATE_KEY");
    expect(content).toContain("PORT");
  });

  it("warns about placeholder values", () => {
    expect(content).toContain("Placeholder values");
  });

  it("copies from .env.example templates", () => {
    expect(content).toContain(".env.example");
  });

  it("warns about committing secrets", () => {
    expect(content).toContain("Never commit");
  });

  it("shows help with --help flag", () => {
    const help = runHelp("deploy/setup-env.sh");
    expect(help).toContain("Usage");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: rollback.sh
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: rollback.sh", () => {
  const content = readScript("deploy/rollback.sh");

  it("supports --target=hub", () => {
    expect(content).toContain("rollback_hub");
  });

  it("supports --target=provider", () => {
    expect(content).toContain("rollback_provider");
  });

  it("supports --deployment-id flag", () => {
    expect(content).toContain("--deployment-id");
  });

  it("requires --target argument", () => {
    expect(content).toContain("Missing --target");
  });

  it("uses vercel rollback for hub", () => {
    expect(content).toContain("vercel rollback");
  });

  it("uses railway redeploy for provider", () => {
    expect(content).toContain("railway redeploy");
  });

  it("shows help with --help flag", () => {
    const help = runHelp("deploy/rollback.sh");
    expect(help).toContain("Usage");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: Health Check Scripts
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: check-hub.sh", () => {
  const content = readScript("health/check-hub.sh");

  it("checks homepage endpoint", () => {
    expect(content).toContain("Homepage");
  });

  it("checks playground page", () => {
    expect(content).toContain("/playground");
  });

  it("checks marketplace page", () => {
    expect(content).toContain("/marketplace");
  });

  it("validates content type", () => {
    expect(content).toContain("content_type");
    expect(content).toContain("text/html");
  });

  it("supports --url flag", () => {
    expect(content).toContain("--url=");
  });

  it("exits non-zero on failure", () => {
    expect(content).toContain("exit 1");
  });
});

describe("Deployment Scripts: check-provider.sh", () => {
  const content = readScript("health/check-provider.sh");

  it("checks health endpoint", () => {
    expect(content).toContain("/health");
  });

  it("checks catalog endpoint", () => {
    expect(content).toContain("/ivxp/catalog");
  });

  it("validates health status field", () => {
    expect(content).toContain(".status");
  });

  it("validates catalog has services", () => {
    expect(content).toContain("services");
  });

  it("supports --url flag", () => {
    expect(content).toContain("--url=");
  });

  it("exits non-zero on failure", () => {
    expect(content).toContain("exit 1");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: Database Scripts
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: init-provider-db.sh", () => {
  const content = readScript("db/init-provider-db.sh");

  it("supports --remote flag for Railway", () => {
    expect(content).toContain("--remote");
    expect(content).toContain("railway run");
  });

  it("supports --db-path flag", () => {
    expect(content).toContain("--db-path=");
  });

  it("creates parent directory if needed", () => {
    expect(content).toContain("mkdir -p");
  });

  it("shows help with --help flag", () => {
    const help = runHelp("db/init-provider-db.sh");
    expect(help).toContain("Usage");
  });
});

describe("Deployment Scripts: backup-db.sh", () => {
  const content = readScript("db/backup-db.sh");

  it("creates timestamped backups", () => {
    expect(content).toContain("TIMESTAMP");
    expect(content).toContain("orders_backup_");
  });

  it("supports --db-path flag", () => {
    expect(content).toContain("--db-path=");
  });

  it("supports --output-dir flag", () => {
    expect(content).toContain("--output-dir=");
  });

  it("cleans up old backups (keeps last 10)", () => {
    expect(content).toContain("-gt 10");
  });

  it("handles WAL files", () => {
    expect(content).toContain("-wal");
    expect(content).toContain("-shm");
  });

  it("shows help with --help flag", () => {
    const help = runHelp("db/backup-db.sh");
    expect(help).toContain("Usage");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: verify-build.sh
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: verify-build.sh", () => {
  const content = readScript("utils/verify-build.sh");

  it("checks Node.js version >= 20", () => {
    expect(content).toContain("-lt 20");
  });

  it("requires pnpm", () => {
    expect(content).toContain('require_command "pnpm"');
  });

  it("runs lint", () => {
    expect(content).toContain("pnpm lint");
  });

  it("runs typecheck", () => {
    expect(content).toContain("pnpm typecheck");
  });

  it("runs tests", () => {
    expect(content).toContain("pnpm");
    expect(content).toContain("test");
  });

  it("supports hub, provider, and all targets", () => {
    expect(content).toContain("hub)");
    expect(content).toContain("provider)");
    expect(content).toContain("all)");
  });

  it("builds packages in dependency order for hub", () => {
    expect(content).toContain("@ivxp/protocol");
    expect(content).toContain("@ivxp/sdk");
    expect(content).toContain("@ivxp/hub");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: monitor-deployment.sh
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: monitor-deployment.sh", () => {
  const content = readScript("utils/monitor-deployment.sh");

  it("supports --target flag", () => {
    expect(content).toContain("--target=");
  });

  it("supports --interval flag", () => {
    expect(content).toContain("--interval=");
  });

  it("supports --count flag for finite runs", () => {
    expect(content).toContain("--count=");
  });

  it("checks both hub and provider by default", () => {
    expect(content).toContain('TARGET="all"');
  });

  it("uses http_status from common.sh", () => {
    expect(content).toContain("http_status");
  });

  it("shows help with --help flag", () => {
    const help = runHelp("utils/monitor-deployment.sh");
    expect(help).toContain("Usage");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: Deployment Configuration Files
// ════════════════════════════════════════════════════════════════════
describe("Deployment Configuration", () => {
  it("vercel.json exists for Hub", () => {
    expect(existsSync(join(ROOT_DIR, "apps/hub/vercel.json"))).toBe(true);
  });

  it("vercel.json has correct framework", () => {
    const config = JSON.parse(readFileSync(join(ROOT_DIR, "apps/hub/vercel.json"), "utf-8"));
    expect(config.framework).toBe("nextjs");
  });

  it("railway.toml exists for Provider", () => {
    expect(existsSync(join(ROOT_DIR, "apps/demo-provider/railway.toml"))).toBe(true);
  });

  it("Dockerfile exists for Provider", () => {
    expect(existsSync(join(ROOT_DIR, "apps/demo-provider/Dockerfile"))).toBe(true);
  });

  it("Hub .env.example exists", () => {
    expect(existsSync(join(ROOT_DIR, "apps/hub/.env.example"))).toBe(true);
  });

  it("Provider .env.example exists", () => {
    expect(existsSync(join(ROOT_DIR, "apps/demo-provider/.env.example"))).toBe(true);
  });

  it("deployment documentation exists", () => {
    expect(existsSync(join(ROOT_DIR, "docs/deployment/README.md"))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: Dry-Run Mode
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: Dry-Run Support", () => {
  const scriptsWithDryRun = [
    "deploy/deploy-hub.sh",
    "deploy/deploy-provider.sh",
    "deploy/rollback.sh",
    "db/init-provider-db.sh",
    "db/backup-db.sh",
  ] as const;

  it.each(scriptsWithDryRun)("script uses run_cmd for dry-run support: %s", (script) => {
    const content = readScript(script);
    expect(content).toContain("run_cmd");
  });
});

// ════════════════════════════════════════════════════════════════════
// Test Suite: Security Checks
// ════════════════════════════════════════════════════════════════════
describe("Deployment Scripts: Security", () => {
  it.each(EXPECTED_SCRIPTS)("script does not contain hardcoded secrets: %s", (script) => {
    const content = readScript(script);
    // Check for common secret patterns
    expect(content).not.toMatch(/sk_live_[a-zA-Z0-9]+/);
    expect(content).not.toMatch(/AKIA[A-Z0-9]{16}/);
    expect(content).not.toMatch(
      /0x[a-fA-F0-9]{64}(?!0{10})/, // real private keys (not placeholder zeros)
    );
  });

  it("setup-env.sh warns about secrets", () => {
    const content = readScript("deploy/setup-env.sh");
    expect(content).toContain("Never commit");
  });
});
