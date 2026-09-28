"use client";

import React, { createContext, useCallback, useContext, type ReactNode } from "react";
import {
  createPublicClient,
  http,
  type Address,
  type WalletClient,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
  type Connector,
} from "wagmi";
import {
  CONTRACT_ADDRESS,
  DARE_ABI,
  ERC20_ABI,
  BASE_CHAIN_ID,
} from "@/lib/contract";

interface Web3ContextType {
  address: Address | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | null;
  connectors: readonly Connector[];
  connect: () => Promise<void>;
  connectWallet: (connector: Connector) => Promise<void>;
  disconnect: () => void;
  switchToBaseSepolia: () => Promise<void>;
  publicClient: any;
  walletClient: WalletClient | null;
  readContract: (functionName: string, args?: any[]) => Promise<any>;
  writeContract: (
    functionName: string,
    args?: any[],
    value?: bigint
  ) => Promise<`0x${string}`>;
  approveToken: (token: Address, amount: bigint) => Promise<`0x${string}`>;
  getAllowance: (token: Address, owner: Address) => Promise<bigint>;
  signMessage: (message: string) => Promise<`0x${string}`>;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

const publicClient: any = createPublicClient({
  chain: baseSepolia,
  transport: http(
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
    {
      timeout: 15000,
      retryCount: 3,
      retryDelay: 1000,
    }
  ),
});

const BASE_SEPOLIA_ADD_PARAMS = {
  chainId: "0x14a34",
  chainName: "Base Sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
  ],
  blockExplorerUrls: ["https://sepolia.basescan.org"],
};

function isUnknownChainError(error: any) {
  return (
    error?.code === 4902 ||
    error?.cause?.code === 4902 ||
    error?.cause?.cause?.code === 4902 ||
    /chain.+not.+configured|unrecognized chain|unknown chain/i.test(
      error?.message ?? ""
    )
  );
}

export function Web3Provider({ children }: { children: ReactNode }) {
  const { address, isConnected, isConnecting, chainId, connector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const addBaseSepolia = useCallback(async (targetConnector?: Connector | null) => {
    const activeConnector = targetConnector ?? connector;
    if (!activeConnector) {
      throw new Error("No wallet connector is available.");
    }

    const provider = (await activeConnector.getProvider()) as {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    } | null;

    if (!provider || typeof provider.request !== "function") {
      throw new Error("This wallet does not support adding networks from the app.");
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [BASE_SEPOLIA_ADD_PARAMS],
    });
  }, [connector]);

  const switchToBaseSepolia = useCallback(async () => {
    if (!isConnected) {
      throw new Error("Wallet not connected");
    }

    if (chainId === BASE_CHAIN_ID) return;

    try {
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
    } catch (error) {
      if (!isUnknownChainError(error)) throw error;
      await addBaseSepolia();
      await switchChainAsync({ chainId: BASE_CHAIN_ID });
    }
  }, [addBaseSepolia, chainId, isConnected, switchChainAsync]);

  const connectWallet = useCallback(
    async (targetConnector: Connector) => {
      await connectAsync({ connector: targetConnector });

      // Connecting and network selection are separate wallet permissions.
      // If the wallet is already on another chain, ask it to move to Base Sepolia.
      try {
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      } catch (error) {
        if (isUnknownChainError(error)) {
          await addBaseSepolia(targetConnector);
          await switchChainAsync({ chainId: BASE_CHAIN_ID });
        } else {
          // Keep the wallet connected. The header will show Wrong network and
          // the user can retry the Base Sepolia switch explicitly.
          console.warn("Base Sepolia switch was not completed", error);
        }
      }
    }, [addBaseSepolia, connectAsync, switchChainAsync]);

  const connect = useCallback(async () => {
    if (!connectors.length) {
      throw new Error("No compatible wallet is available.");
    }

    // Preserve the old no-argument API used throughout the app. The header
    // exposes the full connector picker when multiple wallets are available.
    await connectWallet(connectors[0]);
  }, [connectWallet, connectors]);

  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  const readContract = useCallback(
    async (functionName: string, args: any[] = []) => {
      try {
        return await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: DARE_ABI as any,
          functionName,
          args,
        } as any);
      } catch (error) {
        if (functionName === "getUserBadge") {
          try {
            return await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: DARE_ABI as any,
              functionName: "badge",
              args,
            } as any);
          } catch {
            // Fall through to the original error.
          }
        }
        console.error("readContract error:", error);
        throw error;
      }
    },
    []
  );

  const writeContract = useCallback(
    async (
      functionName: string,
      args: any[] = [],
      value?: bigint
    ): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }
      if (chainId !== BASE_CHAIN_ID) {
        throw new Error("Please switch to Base Sepolia first.");
      }

      try {
        // Base Sepolia can return an invalid/oversized automatic gas estimate for
        // resolveAfterProofTimeout on older Dare states. The contract path itself
        // is bounded, so bypass the bad estimator for this one action only.
        // Keep every other transaction on the wallet/RPC's normal estimation.
        const gas =
          functionName === "resolveAfterProofTimeout" ? 500_000n : undefined;

        const hash = await (walletClient as any).writeContract({
          address: CONTRACT_ADDRESS,
          abi: DARE_ABI as any,
          functionName,
          args,
          value,
          account: address,
          chain: baseSepolia,
          ...(gas !== undefined ? { gas } : {}),
        } as any);
        return hash as `0x${string}`;
      } catch (error: any) {
        console.error("writeContract error:", error);
        if (error?.shortMessage) throw new Error(error.shortMessage);
        throw error;
      }
    },
    [address, chainId, walletClient]
  );

  const approveToken = useCallback(
    async (token: Address, amount: bigint): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }
      if (chainId !== BASE_CHAIN_ID) {
        throw new Error("Please switch to Base Sepolia first.");
      }

      try {
        const hash = await (walletClient as any).writeContract({
          address: token,
          abi: ERC20_ABI as any,
          functionName: "approve",
          args: [CONTRACT_ADDRESS, amount],
          account: address,
          chain: baseSepolia,
        } as any);
        return hash as `0x${string}`;
      } catch (error: any) {
        console.error("approveToken error:", error);
        if (error?.shortMessage) throw new Error(error.shortMessage);
        throw error;
      }
    },
    [address, chainId, walletClient]
  );

  const getAllowance = useCallback(
    async (token: Address, owner: Address): Promise<bigint> => {
      try {
        return (await publicClient.readContract({
          address: token,
          abi: ERC20_ABI as any,
          functionName: "allowance",
          args: [owner, CONTRACT_ADDRESS],
        } as any)) as bigint;
      } catch (error) {
        console.error("getAllowance error:", error);
        throw error;
      }
    },
    []
  );

  const signMessage = useCallback(
    async (message: string): Promise<`0x${string}`> => {
      if (!walletClient || !address) {
        throw new Error("Wallet not connected");
      }

      try {
        return (await walletClient.signMessage({
          account: address,
          message,
        })) as `0x${string}`;
      } catch (error: any) {
        console.error("signMessage error:", error);
        if (error?.shortMessage) throw new Error(error.shortMessage);
        throw error;
      }
    },
    [address, walletClient]
  );

  return (
    <Web3Context.Provider
      value={{
        address: address ?? null,
        isConnected,
        isConnecting,
        chainId: chainId ?? null,
        connectors,
        connect,
        connectWallet,
        disconnect,
        switchToBaseSepolia,
        publicClient,
        walletClient: walletClient ?? null,
        readContract,
        writeContract,
        approveToken,
        getAllowance,
        signMessage,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within a Web3Provider");
  }
  return context;
}
