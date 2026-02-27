# IVXP Framework Conformance Checklist

Use this checklist to validate that your IVXP adapter integration is complete and production-ready.
Each item has an explicit **Pass** and **Fail** criterion.

Complete all five sections before recording your milestone in the adoption tracker.

---

## 1. Adapter Installation

- [ ] Adapter package is installed — **Pass:** `node_modules/@ivxp/adapter-<framework>` exists and `package.json` lists it as a dependency / **Fail:** package is missing or not listed
- [ ] Peer dependency `@ivxp/sdk` is installed — **Pass:** `node_modules/@ivxp/sdk` exists at the required version / **Fail:** missing or version mismatch reported by package manager
- [ ] TypeScript types resolve without errors — **Pass:** `tsc --noEmit` exits 0 / **Fail:** type errors referencing adapter or SDK types
- [ ] Environment variables are defined — **Pass:** `IVXP_PRIVATE_KEY`, `IVXP_NETWORK`, and `IVXP_PROVIDER_URL` are set in the runtime environment / **Fail:** any variable is undefined at startup

---

## 2. Baseline Flow (catalog → quote → payment → deliver → download)

- [ ] `getCatalog()` returns at least one service — **Pass:** response contains `services` array with ≥ 1 entry / **Fail:** empty array or error thrown
- [ ] `requestService()` completes without error — **Pass:** returns `{ orderId, deliverable }` with non-null values / **Fail:** throws or returns null deliverable
- [ ] Payment is confirmed on-chain — **Pass:** transaction hash is present in the result and verifiable on the block explorer / **Fail:** no transaction hash or verification fails
- [ ] Deliverable content is non-empty — **Pass:** `deliverable.content` is a non-empty string or buffer / **Fail:** empty, null, or undefined content
- [ ] Full flow completes in < 120 seconds — **Pass:** wall-clock time from `getCatalog()` to deliverable receipt is under 2 minutes / **Fail:** timeout or exceeds 120 s

---

## 3. Cross-Framework Interop Test

- [ ] A2A client ↔ LangGraph provider transaction succeeds — **Pass:** `IVXPA2AClientAdapter` completes a full flow against an `IVXPLangGraphProviderAdapter` endpoint / **Fail:** error at any step
- [ ] LangGraph client ↔ A2A provider transaction succeeds — **Pass:** `IVXPLangGraphClientAdapter` completes a full flow against an `IVXPA2AProviderAdapter` endpoint / **Fail:** error at any step
- [ ] MCP tool call resolves to a deliverable — **Pass:** `ivxp_request_service` MCP tool returns a non-empty result / **Fail:** tool call errors or returns empty
- [ ] Cross-framework payment amounts match — **Pass:** amount quoted equals amount paid across both sides / **Fail:** mismatch detected

---

## 4. Interop Test Suite

- [ ] Test suite runs to completion — **Pass:** `pnpm --filter @ivxp/adapter-a2a test` exits 0 / **Fail:** non-zero exit code
- [ ] Zero test failures — **Pass:** test runner reports 0 failed tests / **Fail:** any test marked as failed
- [ ] No skipped critical tests — **Pass:** all tests tagged `@critical` are executed / **Fail:** critical tests are skipped
- [ ] Coverage ≥ 80% — **Pass:** coverage report shows ≥ 80% line coverage / **Fail:** below threshold

---

## 5. Documentation Publication

- [ ] Integration documentation is published at a public URL — **Pass:** URL is reachable and returns HTTP 200 / **Fail:** URL is unreachable or returns error
- [ ] Documentation URL is recorded in the milestone tracker — **Pass:** `docs/adoption-milestones.md` (or equivalent) contains the URL / **Fail:** URL is not recorded
- [ ] Documentation references the correct adapter package version — **Pass:** published docs specify the exact `@ivxp/adapter-<framework>` version used / **Fail:** version is missing or incorrect
- [ ] Documentation includes the quickstart or equivalent getting-started guide — **Pass:** a reader unfamiliar with IVXP can complete a transaction by following the published docs alone / **Fail:** critical steps are missing or require external knowledge
