import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = resolve(__dirname, "..", "packages");

const PACKAGE_NAMES = ["protocol", "sdk", "test-utils"] as const;

const REQUIRED_FIELDS = [
  "name",
  "version",
  "description",
  "main",
  "module",
  "types",
  "exports",
  "files",
  "license",
  "publishConfig",
  "repository",
] as const;

function readPackageJson(pkgName: string): Record<string, unknown> {
  const pkgPath = resolve(PACKAGES_DIR, pkgName, "package.json");
  return JSON.parse(readFileSync(pkgPath, "utf-8"));
}

describe("npm publish readiness", () => {
  for (const pkgName of PACKAGE_NAMES) {
    describe(`@ivxp/${pkgName}`, () => {
      const pkg = readPackageJson(pkgName);

      it("has correct scoped package name", () => {
        expect(pkg.name).toBe(`@ivxp/${pkgName}`);
      });

      it("is NOT marked as private", () => {
        expect(pkg.private).toBeUndefined();
      });

      it("has version 0.1.0", () => {
        expect(pkg.version).toBe("0.1.0");
      });

      for (const field of REQUIRED_FIELDS) {
        it(`has required field: ${field}`, () => {
          expect(pkg[field]).toBeDefined();
        });
      }

      it("has publishConfig.access set to public", () => {
        const publishConfig = pkg.publishConfig as Record<string, unknown>;
        expect(publishConfig.access).toBe("public");
      });

      it("files array includes dist, README.md, LICENSE", () => {
        const files = pkg.files as string[];
        expect(files).toContain("dist");
        expect(files).toContain("README.md");
        expect(files).toContain("LICENSE");
      });

      it("has LICENSE file", () => {
        const licensePath = resolve(PACKAGES_DIR, pkgName, "LICENSE");
        expect(existsSync(licensePath)).toBe(true);
      });

      it("has README.md file", () => {
        const readmePath = resolve(PACKAGES_DIR, pkgName, "README.md");
        expect(existsSync(readmePath)).toBe(true);
      });

      it("has .npmignore file", () => {
        const npmignorePath = resolve(PACKAGES_DIR, pkgName, ".npmignore");
        expect(existsSync(npmignorePath)).toBe(true);
      });

      it("has prepublishOnly script", () => {
        const scripts = pkg.scripts as Record<string, string>;
        expect(scripts.prepublishOnly).toBeDefined();
        expect(scripts.prepublishOnly).toContain("build");
        expect(scripts.prepublishOnly).toContain("test");
      });

      it("has publish:dry script", () => {
        const scripts = pkg.scripts as Record<string, string>;
        expect(scripts["publish:dry"]).toBeDefined();
      });

      it("exports have types condition first", () => {
        const exports = pkg.exports as Record<string, Record<string, string>>;
        const mainExport = exports["."];
        const keys = Object.keys(mainExport);
        expect(keys[0]).toBe("types");
      });

      it("has repository field with directory", () => {
        const repo = pkg.repository as Record<string, string>;
        expect(repo.type).toBe("git");
        expect(repo.url).toContain("ivxp-protocol");
        expect(repo.directory).toBe(`packages/${pkgName}`);
      });

      it("has valid repository URL format", () => {
        const repo = pkg.repository as Record<string, string>;
        expect(repo.url).toMatch(/^https:\/\/github\.com\/.+\/.+\.git$/);
      });

      it("has valid bugs URL", () => {
        const bugs = pkg.bugs as Record<string, string>;
        expect(bugs.url).toBeDefined();
        expect(bugs.url).toMatch(/^https:\/\/github\.com\/.+\/.+\/issues$/);
      });

      it("has valid homepage URL", () => {
        const homepage = pkg.homepage as string;
        expect(homepage).toBeDefined();
        expect(homepage).toMatch(/^https:\/\/github\.com\/.+\/.+\/tree\/.+\/packages\/.+#readme$/);
      });
    });
  }
});
