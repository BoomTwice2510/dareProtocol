import { NextResponse } from "next/server";
import { CONTRACT_ADDRESS } from "@/lib/contract";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_API_BASE = "https://base-sepolia.blockscout.com/api/v2";
const DEFAULT_EXPLORER_BASE = "https://base-sepolia.blockscout.com";

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Blockscout returned HTTP ${response.status}`);
  }
  return response.json();
}

export async function GET() {
  if (!/^0x[a-fA-F0-9]{40}$/.test(CONTRACT_ADDRESS)) {
    return NextResponse.json(
      { error: "DareProtocol contract address is not configured correctly." },
      { status: 500 }
    );
  }

  const apiBase = (process.env.BLOCKSCOUT_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, "");
  const explorerBase = (process.env.BLOCKSCOUT_EXPLORER_URL || DEFAULT_EXPLORER_BASE).replace(/\/$/, "");
  const address = CONTRACT_ADDRESS.toLowerCase();

  try {
    const [addressResult, transactionsResult] = await Promise.all([
      fetchJson(`${apiBase}/addresses/${address}`),
      fetchJson(`${apiBase}/addresses/${address}/transactions`),
    ]);

    const transactions = Array.isArray(transactionsResult?.items)
      ? transactionsResult.items.slice(0, 12).map((tx: any) => ({
          hash: tx.hash ?? "",
          blockNumber: tx.block_number ?? null,
          timestamp: tx.timestamp ?? null,
          from: tx.from?.hash ?? null,
          to: tx.to?.hash ?? null,
          value: tx.value ?? "0",
          fee: tx.fee?.value ?? null,
          result: tx.result ?? null,
          method: tx.method ?? tx.decoded_input?.method_call ?? null,
          status: tx.status ?? null,
        }))
      : [];

    return NextResponse.json(
      {
        source: "Blockscout API v2",
        chain: "Base Sepolia",
        chainId: 84532,
        contractAddress: address,
        explorerBase,
        contract: {
          name: addressResult?.name ?? null,
          isContract: addressResult?.is_contract ?? null,
          isVerified: addressResult?.is_verified ?? addressResult?.metadata?.is_verified ?? null,
          transactionCount: addressResult?.transactions_count ?? addressResult?.tx_count ?? null,
          coinBalance: addressResult?.coin_balance ?? null,
        },
        transactions,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Blockscout API error";
    return NextResponse.json(
      {
        error: `Unable to load live Blockscout data: ${message}`,
        source: "Blockscout API v2",
        chain: "Base Sepolia",
        chainId: 84532,
        contractAddress: address,
        explorerBase,
      },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
