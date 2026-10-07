# ProposalProof for GenLayer

ProposalProof is an interactive governance operations console backed directly by the deployed ProposalExecutionGuard Intelligent Contract. It binds a public proposal, its approved action list, an execution transaction, and two to five independent sources into a durable GenLayer consensus receipt.

## Live contract

- Address: `0xA972D14f7029a6263645DB72ca46eeF81e088280`
- Explorer: https://explorer-studio.genlayer.com/address/0xA972D14f7029a6263645DB72ca46eeF81e088280
- Finalized example: `peg_443f8cba63e00ce90477`

## Live application

- App: https://proposalproof-genlayer.galaxthoo.chatgpt.site
- Evidence mirror: https://proposalproof-genlayer.galaxthoo.chatgpt.site/evidence/aave-359
- Source snapshot: https://github.com/klopp78/proposalproof-genlayer/blob/main/evidence/aave-359.md

## Product flow

1. Connect a browser wallet to Studionet.
2. Enter the governance body, proposal ID, canonical proposal page, execution transaction, approved actions, and independent evidence sources.
3. Submit the assessment to GenLayer full consensus.
4. Read the returned `peg_*` record from accepted or finalized state.
5. Inspect validator-accepted match flags, confidence, source counts, timestamps, and cryptographic commitments.

The UI never calculates a local verdict. It uses `genlayer-js` for writes and readback, and every visible result comes from contract state.

## Checks

```bash
npm run contract:check
npm run build
```
