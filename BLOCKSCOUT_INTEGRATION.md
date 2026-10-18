# Blockscout integration

DareProtocol now includes an `/onchain` page backed by a server-side route at `/api/blockscout/activity`.

## What it does

- Calls Blockscout API v2 for the configured DareProtocol contract address.
- Reads address metadata and the latest transaction page from the explorer API.
- Displays explorer-returned verification status and transaction count when those fields are available.
- Shows real returned transactions and links each transaction and the contract to Blockscout.
- Does not generate mock activity when the explorer API fails or returns no transactions.

## Defaults

The repository currently targets Base Sepolia (chain ID `84532`). If no environment overrides are provided, the integration uses:

- API: `https://base-sepolia.blockscout.com/api/v2`
- Explorer: `https://base-sepolia.blockscout.com`

Set these server-side environment variables if the deployed app should use another Blockscout instance:

```env
BLOCKSCOUT_API_BASE_URL=https://base-sepolia.blockscout.com/api/v2
BLOCKSCOUT_EXPLORER_URL=https://base-sepolia.blockscout.com
```

For a mainnet deployment, configure the API and explorer URLs for the correct network and make sure `NEXT_PUBLIC_CHAIN_ID` and `NEXT_PUBLIC_DARE_CONTRACT_ADDRESS` match that deployment. Do not point a mainnet contract at the Base Sepolia explorer.

## Verification checklist

1. Start the app and open `/onchain`.
2. Confirm `/api/blockscout/activity` returns `source: "Blockscout API v2"` and live metadata.
3. Confirm recent transaction hashes open on the configured Blockscout explorer.
4. If the API fails, inspect the returned error and confirm the API host is reachable from the deployed server.
5. Treat the contract as the source of truth for escrow state. Explorer data is an indexed view and can lag.

The code was added at repository level. This environment had no installed project dependencies and could not resolve external network hosts, so a full Next.js build and live API smoke test could not be completed here.
