const proposalUrl = "https://vote.onaave.com/proposal/?ipfsHash=0x5c6bcd27cc94e27f40112647e0fde323c17706ce82746008ceae9d707deb0208&proposalId=359";
const transactionUrl = "https://etherscan.io/tx/0x7a41b0b367d7914389edfdf132c9031fb6379bb97e7b6b0139c02ffd087f1ded";
const discussionUrl = "https://governance.aave.com/t/arfc-claiming-aave-rewards-for-the-sablier-legacy-v1-1-contract/21975";

export default function EvidencePage() {
  return (
    <main className="evidence-page">
      <header>
        <p className="kicker">ProposalProof evidence mirror</p>
        <h1>Aave proposal 359</h1>
        <p className="lede">A readable snapshot for validator access. The linked Aave and Ethereum records remain the canonical sources.</p>
      </header>

      <section>
        <h2>Proposal identity</h2>
        <dl>
          <div><dt>Governance</dt><dd>Aave Governance</dd></div>
          <div><dt>Proposal ID</dt><dd>359</dd></div>
          <div><dt>Proposal hash</dt><dd><code>0x5c6bcd27cc94e27f40112647e0fde323c17706ce82746008ceae9d707deb0208</code></dd></div>
        </dl>
        <a href={proposalUrl}>Open canonical proposal</a>
      </section>

      <section>
        <h2>Approved action</h2>
        <p>Call <code>claimRewardsOnBehalf()</code> for Sablier Legacy v1.1 and distribute <code>895805689180182547296</code> wei of AAVE to <code>sablier.eth</code>.</p>
      </section>

      <section>
        <h2>Execution record</h2>
        <dl>
          <div><dt>Target chain</dt><dd>Ethereum</dd></div>
          <div><dt>Transaction</dt><dd><code>0x7a41b0b367d7914389edfdf132c9031fb6379bb97e7b6b0139c02ffd087f1ded</code></dd></div>
        </dl>
        <div className="evidence-links"><a href={transactionUrl}>Open canonical transaction</a><a href={discussionUrl}>Open governance discussion</a></div>
      </section>

      <section className="integrity-note">
        <h2>Integrity note</h2>
        <p>ProposalProof submits the complete source bundle to its deployed GenLayer contract. Validators render and compare the evidence, then persist the accepted record and source snapshot commitments. This page is an explicit mirror for accessibility, not an independent authority.</p>
      </section>
    </main>
  );
}
