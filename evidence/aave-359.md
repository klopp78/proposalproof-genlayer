# Aave proposal 359 execution evidence snapshot

This document is a human-readable evidence mirror for the ProposalProof demo. It does not replace the canonical governance or block-explorer records. Reviewers and validators should use the links below as the authoritative originals.

## Proposal identity

- Governance: Aave Governance
- Proposal ID: 359
- Proposal hash: `0x5c6bcd27cc94e27f40112647e0fde323c17706ce82746008ceae9d707deb0208`
- Canonical proposal: https://vote.onaave.com/proposal/?ipfsHash=0x5c6bcd27cc94e27f40112647e0fde323c17706ce82746008ceae9d707deb0208&proposalId=359

## Approved action

Call `claimRewardsOnBehalf()` for Sablier Legacy v1.1 and distribute `895805689180182547296` wei of AAVE to `sablier.eth`.

## Execution record

- Target chain: Ethereum
- Transaction: `0x7a41b0b367d7914389edfdf132c9031fb6379bb97e7b6b0139c02ffd087f1ded`
- Canonical transaction: https://etherscan.io/tx/0x7a41b0b367d7914389edfdf132c9031fb6379bb97e7b6b0139c02ffd087f1ded
- Governance discussion: https://governance.aave.com/t/arfc-claiming-aave-rewards-for-the-sablier-legacy-v1-1-contract/21975

## Integrity note

ProposalProof passes the complete source bundle to the deployed GenLayer contract. Validators render the sources, compare the proposal identity, approved actions, and execution transaction, then persist their accepted record and collision-resistant source snapshot commitments. The application displays contract state and does not calculate a local verdict.
