import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { ExecutionResult, TransactionHashVariant, TransactionStatus } from "genlayer-js/types";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_PROPOSAL_EXECUTION_GUARD_ADDRESS ??
    "0xA972D14f7029a6263645DB72ca46eeF81e088280") as `0x${string}`;

export type WalletAddress = `0x${string}`;

export type AssessmentInput = {
  walletAddress: WalletAddress;
  governanceName: string;
  proposalId: string;
  proposalUrl: string;
  executionTxUrl: string;
  declaredActions: string;
  sourceUrls: string[];
  contractAddress?: `0x${string}`;
};

function client(walletAddress?: WalletAddress) {
  return createClient({
    chain: studionet,
    account: walletAddress,
    provider: typeof window !== "undefined" ? window.ethereum : undefined,
  });
}

function address(override?: `0x${string}`) {
  return override ?? CONTRACT_ADDRESS;
}

export async function assessExecution(input: AssessmentInput) {
  const writeClient = client(input.walletAddress);
  await writeClient.connect("studionet");
  const contractAddress = address(input.contractAddress);
  const hash = await writeClient.writeContract({
    address: contractAddress,
    functionName: "assess_execution",
    args: [
      input.governanceName,
      input.proposalId,
      input.proposalUrl,
      input.executionTxUrl,
      input.declaredActions,
      input.sourceUrls,
    ],
    value: BigInt(0),
    leaderOnly: false,
  });
  const receipt = await waitForConsensus(writeClient, hash);
  const assessmentId = extractId(receipt, /peg_[a-f0-9]{20}/);
  const record = assessmentId
    ? await readAssessment(assessmentId, contractAddress)
    : await readLatestAssessment(contractAddress);
  return { hash, assessmentId: assessmentId || record.id, record: record.value };
}

export async function readAssessment(assessmentId: string, contractAddress = CONTRACT_ADDRESS) {
  const value = await read("get_assessment", [assessmentId], contractAddress);
  return { id: assessmentId, value };
}

export async function readLatestAssessment(contractAddress = CONTRACT_ADDRESS) {
  const id = await read("get_latest_assessment_id", [], contractAddress);
  if (!id) throw new Error("The contract has no accepted assessments yet.");
  return readAssessment(id.replaceAll('"', ""), contractAddress);
}

async function read(functionName: string, args: string[], contractAddress: `0x${string}`) {
  const readClient = createClient({ chain: studionet });
  let lastError: unknown;
  for (const transactionHashVariant of [
    TransactionHashVariant.LATEST_FINAL,
    TransactionHashVariant.LATEST_NONFINAL,
  ]) {
    try {
      const result = await readClient.readContract({
        address: contractAddress,
        functionName,
        args,
        jsonSafeReturn: true,
        transactionHashVariant,
      });
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError instanceof Error ? lastError.message : String(lastError));
}

async function waitForConsensus(writeClient: ReturnType<typeof client>, hash: `0x${string}`) {
  try {
    const receipt = await writeClient.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
      interval: 3000,
      retries: 120,
      fullTransaction: true,
    } as never);
    assertSuccess(receipt);
    return receipt;
  } catch {
    const receipt = await writeClient.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      interval: 3000,
      retries: 80,
      fullTransaction: true,
    } as never);
    assertSuccess(receipt);
    return receipt;
  }
}

function assertSuccess(receipt: unknown) {
  if ((receipt as { txExecutionResultName?: string })?.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
    throw new Error("Consensus completed with a contract execution error.");
  }
}

function extractId(value: unknown, pattern: RegExp): string {
  if (typeof value === "string") return value.match(pattern)?.[0] ?? "";
  if (value instanceof Uint8Array) return new TextDecoder().decode(value).match(pattern)?.[0] ?? "";
  if (!value || typeof value !== "object") return "";
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = extractId(child, pattern);
    if (found) return found;
  }
  return "";
}
