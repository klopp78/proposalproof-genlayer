"use client";

import { useMemo, useState } from "react";
import { assessExecution, CONTRACT_ADDRESS, readAssessment, readLatestAssessment, type WalletAddress } from "@/lib/genlayer";

const example = {
  governanceName: "Aave Governance",
  proposalId: "359",
  proposalUrl: "https://vote.onaave.com/proposal/?ipfsHash=0x5c6bcd27cc94e27f40112647e0fde323c17706ce82746008ceae9d707deb0208&proposalId=359",
  executionTxUrl: "https://etherscan.io/tx/0x7a41b0b367d7914389edfdf132c9031fb6379bb97e7b6b0139c02ffd087f1ded",
  declaredActions: "Call claimRewardsOnBehalf() for Sablier Legacy v1.1 and distribute 895805689180182547296 wei of AAVE to sablier.eth.",
  sourceUrls: [
    "https://vote.onaave.com/proposal/?ipfsHash=0x5c6bcd27cc94e27f40112647e0fde323c17706ce82746008ceae9d707deb0208&proposalId=359",
    "https://etherscan.io/tx/0x7a41b0b367d7914389edfdf132c9031fb6379bb97e7b6b0139c02ffd087f1ded",
    "https://governance.aave.com/t/arfc-claiming-aave-rewards-for-the-sablier-legacy-v1-1-contract/21975",
    "https://github.com/klopp78/proposalproof-genlayer/blob/main/evidence/aave-359.md",
    "https://proposalproof-genlayer.galaxthoo.chatgpt.site/evidence/aave-359",
  ],
};

export default function Home() {
  const [form, setForm] = useState(example);
  const [contractAddress, setContractAddress] = useState(CONTRACT_ADDRESS);
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [receiptId, setReceiptId] = useState("peg_443f8cba63e00ce90477");
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState("Ready to inspect the finalized example receipt.");
  const [busy, setBusy] = useState(false);
  const decision = String(record?.decision ?? "not loaded").replaceAll("_", " ");
  const sources = useMemo(() => form.sourceUrls.filter(Boolean), [form.sourceUrls]);

  async function connect() {
    if (!window.ethereum) throw new Error("No browser wallet detected.");
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as WalletAddress[];
    if (!accounts[0]) throw new Error("No wallet account returned.");
    setWallet(accounts[0]);
    setStatus(`Wallet connected: ${short(accounts[0])}`);
    return accounts[0];
  }

  async function load(id?: string) {
    try {
      setBusy(true);
      setStatus("Reading accepted state from GenLayer...");
      const result = id ? await readAssessment(id, contractAddress) : await readLatestAssessment(contractAddress);
      setReceiptId(result.id);
      setRecord(JSON.parse(result.value) as Record<string, unknown>);
      setStatus(`Accepted receipt loaded: ${result.id}`);
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    try {
      setBusy(true);
      setRecord(null);
      const account = wallet ?? (await connect());
      setStatus("Validators are rendering and comparing the evidence bundle...");
      const result = await assessExecution({ walletAddress: account, ...form, sourceUrls: sources, contractAddress });
      setReceiptId(result.assessmentId);
      setRecord(JSON.parse(result.record) as Record<string, unknown>);
      setStatus(`Consensus receipt accepted: ${result.assessmentId}`);
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(false);
    }
  }

  function setField(field: keyof typeof form, value: string | string[]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setSource(index: number, value: string) {
    const next = [...form.sourceUrls];
    next[index] = value;
    setField("sourceUrls", next);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="kicker">GenLayer governance operations</p><h1>ProposalProof</h1></div>
        <div className="header-actions">
          <a className="icon-link" href={`https://explorer-studio.genlayer.com/address/${contractAddress}`} target="_blank" rel="noreferrer">Explorer</a>
          <button className="button" onClick={() => connect().catch((error) => setStatus(message(error)))}>{wallet ? short(wallet) : "Connect wallet"}</button>
        </div>
      </header>

      <section className="status-strip" aria-live="polite"><span className={busy ? "pulse" : "dot"} /><strong>{status}</strong><code>{short(contractAddress)}</code></section>

      <div className="workspace">
        <section className="editor-panel">
          <div className="section-heading">
            <div><span>Assessment input</span><h2>Bind proposal to execution</h2></div>
            <button className="text-button" onClick={() => setForm(example)}>Load verified example</button>
          </div>
          <div className="form-grid">
            <Field label="Governance" value={form.governanceName} onChange={(value) => setField("governanceName", value)} />
            <Field label="Proposal ID" value={form.proposalId} onChange={(value) => setField("proposalId", value)} />
            <Field wide label="Proposal URL" value={form.proposalUrl} onChange={(value) => setField("proposalUrl", value)} />
            <Field wide label="Execution transaction URL" value={form.executionTxUrl} onChange={(value) => setField("executionTxUrl", value)} />
            <label className="field wide"><span>Approved actions</span><textarea value={form.declaredActions} onChange={(event) => setField("declaredActions", event.target.value)} rows={4} /></label>
          </div>
          <div className="evidence-head"><span>Evidence sources</span><small>{sources.length}/5 sources</small></div>
          <div className="evidence-list">
            {form.sourceUrls.map((url, index) => (
              <div className="source-row" key={index}><b>{index + 1}</b><input aria-label={`Evidence source ${index + 1}`} value={url} onChange={(event) => setSource(index, event.target.value)} /><button aria-label={`Remove source ${index + 1}`} onClick={() => setField("sourceUrls", form.sourceUrls.filter((_, item) => item !== index))}>×</button></div>
            ))}
          </div>
          {form.sourceUrls.length < 5 ? <button className="text-button add" onClick={() => setField("sourceUrls", [...form.sourceUrls, ""])}>+ Add source</button> : null}
          <label className="field contract"><span>Contract address</span><input value={contractAddress} onChange={(event) => setContractAddress(event.target.value as `0x${string}`)} /></label>
          <div className="submit-row"><p>Normal consensus · validator-recomputed snapshots</p><button className="button primary" disabled={busy || sources.length < 2} onClick={submit}>{busy ? "Awaiting consensus" : "Verify execution"}</button></div>
        </section>

        <aside className="receipt-panel">
          <div className="section-heading compact"><div><span>On-chain receipt</span><h2>Accepted record</h2></div><div className={`decision ${decision.replaceAll(" ", "-")}`}>{decision}</div></div>
          <div className="lookup"><input aria-label="Receipt ID" value={receiptId} onChange={(event) => setReceiptId(event.target.value)} /><button className="button" disabled={busy || !receiptId} onClick={() => load(receiptId)}>Read</button><button className="button square" title="Read latest receipt" disabled={busy} onClick={() => load()}>↻</button></div>
          <div className="metrics"><Metric label="Confidence" value={record ? `${record.confidence ?? "—"}%` : "—"} /><Metric label="Sources" value={String(record?.supporting_source_count ?? "—")} /><Metric label="Chain" value={String(record?.target_chain ?? "—")} /></div>
          <div className="checks"><Check label="Proposal identity" value={record?.proposal_match} /><Check label="Approved actions" value={record?.action_match} /><Check label="Execution tx" value={record?.execution_tx_match} /></div>
          <dl className="receipt-data">
            <div><dt>Proposal</dt><dd>{String(record?.proposal_id ?? "—")}</dd></div>
            <div><dt>Executed</dt><dd>{String(record?.executed_at_utc ?? "—") || "—"}</dd></div>
            <div><dt>Snapshot bundle</dt><dd><code>{short(String(record?.snapshot_bundle_hash ?? "—"), 12)}</code></dd></div>
            <div><dt>Record hash</dt><dd><code>{short(String((record?.accepted_write as Record<string, unknown> | undefined)?.record_hash ?? "—"), 12)}</code></dd></div>
          </dl>
          <pre>{record ? JSON.stringify(record, null, 2) : "Load a receipt to inspect the validator-accepted record."}</pre>
        </aside>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Check({ label, value }: { label: string; value: unknown }) { const passed = value === true; return <div><span className={passed ? "check yes" : "check"}>{passed ? "✓" : "·"}</span><b>{label}</b><small>{passed ? "matched" : "not confirmed"}</small></div>; }
function short(value: string, size = 6) { return value.length > size * 2 + 3 ? `${value.slice(0, size)}…${value.slice(-size)}` : value; }
function message(error: unknown) { return error instanceof Error ? error.message : String(error); }
