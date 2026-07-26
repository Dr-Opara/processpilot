import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Statically enforces docs/architecture/ai-architecture.md's governance
 * boundary — "AI may draft and suggest but never independently publish,
 * approve, close, or certify" — as a build-time check, not just a
 * documented intention. Every `src/lib/services/ai-*.ts` feature module
 * is scanned for an import of any function that would let it perform
 * one of the forbidden actions directly. This is deliberately a source
 * scan, not a mock-based behavioral test: the point is that the
 * capability doesn't exist in the module at all, which a runtime test
 * calling the function couldn't distinguish from "the capability exists
 * but happened not to be exercised by this test."
 */

const AI_SERVICES_DIR = path.resolve(__dirname);

const FORBIDDEN_IMPORTS = [
  // Publishing
  "publishProcessVersion",
  "publishFormVersion",
  "publishCourseVersion",
  "approveAndPublish",
  // Approving
  "decideApproval",
  "decideApprovalChain",
  "overrideApprovalDecision",
  "decideCapaPlanApproval",
  "decideWaiver",
  // Closing / rejecting / resolving
  "closeException",
  "rejectException",
  "closeCapaPlan",
  "resolveException",
  // Certifying
  "issueCertification",
  "completeTrainingAssignment",
  "renewCertification",
  "revokeCertification",
  // Permission changes
  "assignRole",
  "createCustomRole",
  "updateRolePermissions",
  // Irreversible communications (Phase 16, not yet built, but blocked pre-emptively)
  "sendEmail",
  "sendNotification",
];

function listAiServiceFiles(): string[] {
  return fs
    .readdirSync(AI_SERVICES_DIR)
    .filter((file) => file.startsWith("ai-") && file.endsWith(".ts") && !file.endsWith(".test.ts"));
}

describe("AI governance boundary — no ai-*.ts service imports a mutating publish/approve/close/certify function", () => {
  const files = listAiServiceFiles();

  it("found at least one AI feature module to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} imports none of the forbidden mutation functions`, () => {
      const source = fs.readFileSync(path.join(AI_SERVICES_DIR, file), "utf8");
      const importLines = source.split("\n").filter((line) => line.trim().startsWith("import "));
      const importedNames = importLines.join("\n");

      const violations = FORBIDDEN_IMPORTS.filter((name) =>
        new RegExp(`\\b${name}\\b`).test(importedNames),
      );
      expect(
        violations,
        `${file} imports forbidden mutation function(s): ${violations.join(", ")}`,
      ).toEqual([]);
    });
  }
});
