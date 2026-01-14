/**
 * Multi-chain configuration and constants
 * Easily extensible - just add new chains here and they'll be automatically supported
 */

export enum ChainType {
  EVM = "EVM",
  SOLANA = "SOLANA",
  SUI = "SUI",
  BITCOIN = "BITCOIN",
}

export interface ChainConfig {
  id: string;
  name: string;
  type: ChainType;
  chainId?: number; // For EVM chains
  derivationPath: string;
  rpcUrl?: string;
  explorerUrl?: string;
  nativeCurrency?: {
    symbol: string;
    decimals: number;
  };
}

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  bitcoin: {
    id: "bitcoin",
    name: "Bitcoin",
    type: ChainType.BITCOIN,
    derivationPath: "m/84'/0'/0'/0/0", // Native SegWit (Bech32) - P2WPKH
    rpcUrl: process.env.NEXT_PUBLIC_BITCOIN_RPC_URL,
    explorerUrl: "https://blockstream.info",
    nativeCurrency: {
      symbol: "BTC",
      decimals: 8,
    },
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    type: ChainType.EVM,
    chainId: 1,
    derivationPath: "m/44'/60'/0'/0/0",
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    nativeCurrency: {
      symbol: "ETH",
      decimals: 18,
    },
  },
  base: {
    id: "base",
    name: "Base",
    type: ChainType.EVM,
    chainId: 8453,
    derivationPath: "m/44'/60'/0'/0/0", // Same as Ethereum (EVM-compatible)
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://base.llamarpc.com",
    explorerUrl: "https://basescan.org",
    nativeCurrency: {
      symbol: "ETH",
      decimals: 18,
    },
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    type: ChainType.EVM,
    chainId: 137,
    derivationPath: "m/44'/60'/0'/0/0", // Same as Ethereum (EVM-compatible)
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://polygon.llamarpc.com",
    explorerUrl: "https://polygonscan.com",
    nativeCurrency: {
      symbol: "MATIC",
      decimals: 18,
    },
  },
  monad: {
    id: "monad",
    name: "Monad",
    type: ChainType.EVM,
    chainId: 10143, // Monad mainnet chain ID (verify when mainnet launches)
    derivationPath: "m/44'/60'/0'/0/0", // Same as Ethereum (EVM-compatible)
    rpcUrl: process.env.NEXT_PUBLIC_MONAD_RPC_URL,
    explorerUrl: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL,
    nativeCurrency: {
      symbol: "MON",
      decimals: 18,
    },
  },
  solana: {
    id: "solana",
    name: "Solana",
    type: ChainType.SOLANA,
    derivationPath: "m/44'/501'/0'/0'",
    rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    explorerUrl: "https://solscan.io",
    nativeCurrency: {
      symbol: "SOL",
      decimals: 9,
    },
  },
  sui: {
    id: "sui",
    name: "Sui",
    type: ChainType.SUI,
    derivationPath: "m/44'/784'/0'/0'/0'",
    rpcUrl: process.env.NEXT_PUBLIC_SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443",
    explorerUrl: "https://suiexplorer.com",
    nativeCurrency: {
      symbol: "SUI",
      decimals: 9,
    },
  },
};

/**
 * Get chain configuration by ID
 */
export function getChainConfig(chainId: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId];
}

/**
 * Get all EVM chains
 */
export function getEVMChains(): ChainConfig[] {
  return Object.values(SUPPORTED_CHAINS).filter(
    (chain) => chain.type === ChainType.EVM
  );
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): string[] {
  return Object.keys(SUPPORTED_CHAINS);
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: string): boolean {
  return chainId in SUPPORTED_CHAINS;
}

