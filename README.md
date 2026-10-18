# Dare Protocol

Dare Protocol is an on-chain escrow challenge protocol for Base.

## V1 assets

- Base ETH
- Base USDC
- Base Sepolia ETH
- Base Sepolia USDC

No other ERC20 is supported.

## V1 lifecycle

1. Creator creates a dare with a 1h to 7d task duration and chooses whether proof is required.
2. Anyone except the creator can accept within 24h by matching the exact stake.
3. The task timer starts at acceptance.
4. If proof is disabled, the accepter can be resolved as winner after the deadline.
5. If proof is enabled, the accepter has 24h after the deadline to submit immutable proof reference data.
6. The creator has 24h to confirm or dispute.
7. A dispute opens a public 24h evidence window and a 48h total judge window.
8. Only the judge can resolve a disputed dare.

The contract is non-upgradeable. Railway services are indexing/notification/keeper infrastructure only and are not required for custody or protocol correctness.

## Development

```bash
npm install
npm run typecheck
npm run contract:compile
npm run contract:test
npm run build
```

## Deployment

Deployment requires constructor values for:

- protocol admin multisig
- judge multisig
- treasury multisig
- USDC contract
- Chainlink ETH/USD feed

See `.env.example` and `MAINNET_READINESS.md`.

## Mainnet rule

Do not deploy the immutable mainnet contract until the complete test matrix in `MAINNET_READINESS.md` is green and the constructor addresses have been independently verified.


## Blockscout on-chain activity

Open `/onchain` to view DareProtocol contract metadata and recent transactions fetched server-side from Blockscout API v2. Configuration and verification steps are documented in [`BLOCKSCOUT_INTEGRATION.md`](./BLOCKSCOUT_INTEGRATION.md).
