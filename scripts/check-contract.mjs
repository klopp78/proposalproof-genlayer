import { readFileSync } from "node:fs";

const source = readFileSync("contracts/proposal_execution_guard.py", "utf8");
const required = [
  "class ProposalExecutionGuard(gl.Contract)",
  "def assess_execution(",
  "source_snapshot_hashes",
  "snapshot_bundle_hash",
  "assessment_context_hash",
  "execution_already_claimed",
  "hashlib.sha256",
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Missing contract marker: ${marker}`);
}
console.log("ProposalExecutionGuard contract check passed");
