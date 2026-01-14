import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getERC20Balance, getNativeBalance, getPublicClientForChain } from "@/lib/blockchain";
import { Connection, PublicKey } from "@solana/web3.js";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { SEND_TOKEN_ADDRESS } from "@/lib/constants";
import { formatUnits } from "viem";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const DEXSCREENER_API_BASE = "https://api.dexscreener.com/latest/dex";

/**
 * Fetch token price from DexScreener by contract address
 * DexScreener supports 80+ chains including Base, Ethereum, Polygon, Solana, etc.
 * Works for all tokens that are trading on DEXes
 */
async function getTokenPriceFromDexScreener(
  tokenAddress: string,
  chainId: string
): Promise<number> {
  try {
    // DexScreener chain mapping (supports 80+ chains)
    // For EVM chains, use lowercase chain name
    // For Solana, use "solana"
    // Bitcoin and Sui may not be supported by DexScreener (they use different mechanisms)
    const chainMap: Record<string, string> = {
      base: "base",
      ethereum: "ethereum",
      polygon: "polygon",
      solana: "solana",
      // Add more chains as needed
      arbitrum: "arbitrum",
      optimism: "optimism",
      bsc: "bsc",
      avalanche: "avalanche",
      fantom: "fantom",
    };
    
    const dexscreenerChain = chainMap[chainId];
    if (!dexscreenerChain) {
      // For unsupported chains (like Bitcoin, Sui), return 0 and let CoinGecko handle it
      console.log(`[DexScreener] Chain ${chainId} not in DexScreener chain map, will try CoinGecko`);
      return 0;
    }

    // DexScreener API: /tokens/{tokenAddresses}
    // Works for both EVM (0x addresses) and Solana (base58 addresses)
    // For EVM: use lowercase address
    // For Solana: use the mint address as-is
    const normalizedAddress = chainId === "solana" 
      ? tokenAddress  // Solana addresses are case-sensitive
      : tokenAddress.toLowerCase(); // EVM addresses should be lowercase
    
    const apiUrl = `${DEXSCREENER_API_BASE}/tokens/${normalizedAddress}`;
    console.log(`[DexScreener] Fetching price for ${chainId}: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.error(`[DexScreener] API error: ${response.status} ${response.statusText}`);
      return 0;
    }

    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      console.log(`[DexScreener] No trading pairs found for ${tokenAddress} on ${chainId}`);
      return 0;
    }

    console.log(`[DexScreener] Found ${data.pairs.length} trading pairs for ${tokenAddress}`);

    // Find the best pair (usually the one with highest liquidity or on the target chain)
    // Filter for pairs on the target chain
    const chainPairs = data.pairs.filter((pair: any) => {
      const pairChain = pair.chainId?.toLowerCase();
      return pairChain === dexscreenerChain.toLowerCase();
    });
    
    // Use chain-specific pairs if available, otherwise use any pair
    const pairsToCheck = chainPairs.length > 0 ? chainPairs : data.pairs;
    
    // Sort by liquidity (USD) and get the best pair
    // Also consider volume24h as secondary metric
    const bestPair = pairsToCheck.sort((a: any, b: any) => {
      const aLiquidity = parseFloat(a.liquidity?.usd || "0");
      const bLiquidity = parseFloat(b.liquidity?.usd || "0");
      
      // If liquidity is similar, use volume
      if (Math.abs(aLiquidity - bLiquidity) < 1000) {
        const aVolume = parseFloat(a.volume?.h24 || "0");
        const bVolume = parseFloat(b.volume?.h24 || "0");
        return bVolume - aVolume;
      }
      
      return bLiquidity - aLiquidity;
    })[0];

    if (bestPair && bestPair.priceUsd) {
      const price = parseFloat(bestPair.priceUsd);
      const pairInfo = bestPair.pairAddress 
        ? `pair: ${bestPair.pairAddress.substring(0, 10)}...`
        : `DEX: ${bestPair.dexId || "unknown"}`;
      console.log(`[DexScreener] Found price for ${tokenAddress} on ${chainId}: $${price} (${pairInfo})`);
      return price;
    }

    console.log(`[DexScreener] No valid price found for ${tokenAddress} on ${chainId}`);
    return 0;
  } catch (error) {
    console.error(`[DexScreener] Error fetching price for ${tokenAddress} on ${chainId}:`, error);
    return 0;
  }
}

/**
 * Fetch token price - tries DexScreener first, then CoinGecko as fallback
 */
async function getTokenPriceByAddress(
  tokenAddress: string,
  chainId: string
): Promise<number> {
  try {
    // Try DexScreener first (better for DEX tokens)
    const dexscreenerPrice = await getTokenPriceFromDexScreener(tokenAddress, chainId);
    if (dexscreenerPrice > 0) {
      return dexscreenerPrice;
    }

    // Fallback to CoinGecko for major tokens and chains not on DexScreener
    // CoinGecko is better for native tokens (BTC, ETH, SOL, SUI) and major stablecoins
    
    // Native token coin IDs for CoinGecko
    const nativeTokenMap: Record<string, string> = {
      base: "ethereum", // Base native uses ETH
      ethereum: "ethereum",
      polygon: "matic-network",
      solana: "solana",
      bitcoin: "bitcoin",
      sui: "sui",
    };
    
    // Chain IDs for token price lookups (different from native token IDs)
    const tokenPriceChainMap: Record<string, string> = {
      base: "base", // Base tokens use "base" chain ID
      ethereum: "ethereum",
      polygon: "polygon",
      solana: "solana",
    };

    // For native tokens (bitcoin, sui) or when tokenAddress is "native", use coin ID
    if (tokenAddress === "native") {
      const nativeCoinId = nativeTokenMap[chainId];
      if (nativeCoinId) {
        const apiUrl = `${COINGECKO_API_BASE}/simple/price?ids=${nativeCoinId}&vs_currencies=usd`;
        console.log(`[CoinGecko] Fetching native token price (fallback): ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          headers: { Accept: "application/json" },
        });

        if (response.ok) {
          const data = await response.json();
          const price = data[nativeCoinId]?.usd || 0;
          if (price > 0) {
            console.log(`[CoinGecko] Found native token price for ${chainId}: $${price}`);
            return price;
          }
        }
      }
    }

    // For token contracts, use contract address endpoint
    const tokenPriceChainId = tokenPriceChainMap[chainId];
    if (!tokenPriceChainId) {
      console.log(`[CoinGecko] Chain ${chainId} not supported for token prices`);
      return 0;
    }

    // For Solana tokens
    if (chainId === "solana") {
      const apiUrl = `${COINGECKO_API_BASE}/simple/token_price/solana?contract_addresses=${tokenAddress}&vs_currencies=usd`;
      console.log(`[CoinGecko] Fetching Solana token price (fallback): ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        const price = data[tokenAddress]?.usd || 0;
        if (price > 0) {
          console.log(`[CoinGecko] Found Solana token price: $${price}`);
          return price;
        }
      }
    } else {
      // For EVM chains (Base, Ethereum, Polygon, etc.)
      const apiUrl = `${COINGECKO_API_BASE}/simple/token_price/${tokenPriceChainId}?contract_addresses=${tokenAddress.toLowerCase()}&vs_currencies=usd`;
      console.log(`[CoinGecko] Fetching token price (fallback): ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        const contractKey = tokenAddress.toLowerCase();
        const price = data[contractKey]?.usd || 0;
        
        if (price > 0) {
          console.log(`[CoinGecko] Found price for ${tokenAddress}: $${price}`);
          return price;
        }
      }
    }
    
    console.log(`[CoinGecko] No price found for ${tokenAddress} on ${chainId}`);
    return 0;
  } catch (error) {
    console.error(`[Price] Error fetching price for ${tokenAddress}:`, error);
    return 0;
  }
}

/**
 * Fetch native token price from CoinGecko
 */
async function getNativeTokenPrice(chainId: string): Promise<number> {
  try {
    const nativeTokenMap: Record<string, string> = {
      base: "ethereum", // Base uses ETH
      ethereum: "ethereum",
      polygon: "matic-network",
      solana: "solana",
      bitcoin: "bitcoin",
      sui: "sui",
    };

    const coingeckoId = nativeTokenMap[chainId];
    if (!coingeckoId) return 0;

    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) return 0;

    const data = await response.json();
    return data[coingeckoId]?.usd || 0;
  } catch (error) {
    console.error(`Error fetching native token price for ${chainId}:`, error);
    return 0;
  }
}

/**
 * Get comprehensive token list for EVM chain from CoinGecko
 */
async function getTokenListForChain(chainId: string): Promise<string[]> {
  try {
    const chainMap: Record<string, string> = {
      base: "base",
      ethereum: "ethereum",
      polygon: "polygon",
    };

    const coingeckoChainId = chainMap[chainId];
    if (!coingeckoChainId) return [];

    // Fetch top tokens from CoinGecko (we'll use a reasonable limit)
    // Note: CoinGecko doesn't have a direct "all tokens" endpoint, so we'll use
    // a combination of known major tokens and scan for balances
    // For production, you might want to use a token list service or maintain your own list

    // For now, return empty array - we'll discover tokens by scanning
    // In a real implementation, you'd fetch from a comprehensive token list
    return [];
  } catch (error) {
    console.error(`Error fetching token list for ${chainId}:`, error);
    return [];
  }
}

/**
 * Discover all ERC20 tokens in a Base wallet using Basescan API
 */
async function discoverBaseTokensFromBasescan(
  walletAddress: string
): Promise<
  Array<{
    address: string;
    balance: string;
    symbol: string;
    name: string;
    decimals: number;
  }>
> {
  try {
    const apiKey = process.env.BASESCAN_API_KEY || "";
    const apiUrl = apiKey
      ? `https://api.basescan.org/api?module=account&action=addresstokenbalance&address=${walletAddress}&page=1&offset=100&apikey=${apiKey}`
      : `https://api.basescan.org/api?module=account&action=addresstokenbalance&address=${walletAddress}&page=1&offset=100`;

    console.log(`[Basescan] Fetching tokens for address: ${walletAddress}`);
    
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.error(`[Basescan] API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text().catch(() => "");
      console.error(`[Basescan] Error response:`, errorText);
      return [];
    }

    const data = await response.json();
    console.log(`[Basescan] API response status: ${data.status}, message: ${data.message || "OK"}`);

    if (data.status !== "1" || !data.result) {
      console.error(`[Basescan] API returned error: ${data.message || "Unknown error"}`, data);
      return [];
    }

    console.log(`[Basescan] Found ${data.result?.length || 0} token entries in response`);

    const tokens: Array<{
      address: string;
      balance: string;
      symbol: string;
      name: string;
      decimals: number;
    }> = [];

    // Basescan returns balance as a string in the smallest unit (like wei)
    // We need to divide by 10^decimals to get the human-readable amount
    for (const token of data.result) {
      try {
        const decimals = parseInt(token.tokenDecimal || "18", 10);
        const rawBalance = BigInt(token.balance || "0");
        
        // Convert from raw balance to formatted balance using formatUnits
        const balance = formatUnits(rawBalance, decimals);
        const balanceNum = parseFloat(balance);

        // Only include tokens with balance > 0
        if (balanceNum > 0) {
          tokens.push({
            address: (token.contractAddress || "").toLowerCase(),
            balance: balance,
            symbol: token.tokenSymbol || "UNKNOWN",
            name: token.tokenName || token.tokenSymbol || "Unknown Token",
            decimals: decimals,
          });

          // Log for debugging
          console.log(`[Basescan] Found token: ${token.tokenSymbol} - Balance: ${balance}, Address: ${token.contractAddress}`);
        }
      } catch (error) {
        console.error(`[Basescan] Error parsing token:`, token, error);
      }
    }

    console.log(`[Basescan] Total tokens with balance > 0: ${tokens.length}`);
    return tokens;
  } catch (error) {
    console.error("Error discovering tokens from Basescan:", error);
    return [];
  }
}

/**
 * Discover all ERC20 tokens in a wallet by scanning Transfer events
 * This finds all tokens the wallet has received (fallback method)
 */
async function discoverERC20TokensFromEvents(
  chainId: string,
  walletAddress: string
): Promise<string[]> {
  try {
    const publicClient = getPublicClientForChain(chainId);

    // Get recent block number (scan last 10000 blocks to avoid too much data)
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock - BigInt(10000); // Last ~10000 blocks

    // Get logs for Transfer events where 'to' is the wallet address
    const logs = await publicClient.getLogs({
      address: undefined, // Check all contracts
      event: {
        type: "event",
        name: "Transfer",
        inputs: [
          { type: "address", indexed: true, name: "from" },
          { type: "address", indexed: true, name: "to" },
          { type: "uint256", indexed: false, name: "value" },
        ],
      },
      args: {
        to: walletAddress as `0x${string}`,
      },
      fromBlock: fromBlock,
      toBlock: "latest",
    });

    // Extract unique token addresses
    const tokenAddresses = new Set<string>();
    logs.forEach((log) => {
      if (log.address) {
        tokenAddresses.add(log.address.toLowerCase());
      }
    });

    return Array.from(tokenAddresses);
  } catch (error) {
    console.error(`Error discovering tokens from events for ${chainId}:`, error);
    return [];
  }
}

/**
 * Discover all ERC20 tokens in a wallet by checking balances
 * This uses a list of known token addresses and checks which ones have balance > 0
 */
async function discoverERC20Tokens(
  chainId: string,
  walletAddress: string,
  tokenAddresses: string[]
): Promise<
  Array<{
    address: string;
    balance: string;
    symbol: string;
    name: string;
    decimals: number;
  }>
> {
  const discoveredTokens: Array<{
    address: string;
    balance: string;
    symbol: string;
    name: string;
    decimals: number;
  }> = [];

  // Check balances in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    const batchPromises = batch.map(async (tokenAddress) => {
      try {
        const tokenInfo = await getERC20Balance(
          chainId,
          walletAddress,
          tokenAddress
        );

        // Only include tokens with balance > 0
        if (parseFloat(tokenInfo.balance) > 0) {
          return {
            address: tokenAddress,
            balance: tokenInfo.balance,
            symbol: tokenInfo.symbol,
            name: tokenInfo.name,
            decimals: tokenInfo.decimals,
          };
        }
        return null;
      } catch (error) {
        // Token might not exist or contract might not be ERC20
        // Log error for SEND token specifically for debugging
        if (tokenAddress.toLowerCase() === SEND_TOKEN_ADDRESS.toLowerCase()) {
          console.error(`[SEND Token] Error fetching balance:`, error);
        }
        return null;
      }
    });

    const results = await Promise.all(batchPromises);
    const validTokens = results.filter((token): token is NonNullable<typeof token> => token !== null);
    discoveredTokens.push(...validTokens);
    
    // Log if SEND token was found
    const sendToken = validTokens.find(
      (t) => t.address.toLowerCase() === SEND_TOKEN_ADDRESS.toLowerCase()
    );
    if (sendToken) {
      console.log(`[SEND Token] Discovered with balance: ${sendToken.balance} ${sendToken.symbol}`);
    }
  }

  return discoveredTokens;
}

/**
 * Get all SPL tokens in a Solana wallet
 */
async function getAllSolanaTokens(
  walletAddress: string,
  rpcUrl: string
): Promise<
  Array<{
    address: string;
    balance: string;
    symbol: string;
    name: string;
    decimals: number;
  }>
> {
  try {
    const connection = new Connection(rpcUrl);
    const publicKey = new PublicKey(walletAddress);

    // Get all token accounts for this wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      }
    );

    const tokens: Array<{
      address: string;
      balance: string;
      symbol: string;
      name: string;
      decimals: number;
    }> = [];

    for (const accountInfo of tokenAccounts.value) {
      const parsedInfo = accountInfo.account.data.parsed.info;
      const mintAddress = parsedInfo.mint;
      const tokenAmount = parsedInfo.tokenAmount;

      if (tokenAmount.uiAmount && tokenAmount.uiAmount > 0) {
        // Try to get token metadata (name, symbol) from the mint
        // For now, we'll use the mint address and try to fetch metadata
        // In production, you might want to use a token registry
        tokens.push({
          address: mintAddress,
          balance: tokenAmount.uiAmount.toFixed(tokenAmount.decimals),
          symbol: `SPL-${mintAddress.slice(0, 8)}`, // Placeholder
          name: `Token ${mintAddress.slice(0, 8)}`, // Placeholder
          decimals: tokenAmount.decimals,
        });
      }
    }

    return tokens;
  } catch (error) {
    console.error("Error fetching Solana tokens:", error);
    return [];
  }
}

/**
 * Get wallet balances for all chains - scans for ALL tokens
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Get user's wallet addresses
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("wallet_addresses")
      .eq("id", userId)
      .single();

    if (error || !user || !user.wallet_addresses) {
      return NextResponse.json({
        success: true,
        balances: {},
        totalUSD: 0,
        message: "No wallet found",
      });
    }

    const addresses = user.wallet_addresses as Record<string, string>;
    const balances: Record<
      string,
      Record<
        string,
        {
          balance: string;
          usdValue: number;
          symbol: string;
          name: string;
          address: string;
        }
      >
    > = {};

    // Fetch balances for each chain
    const balancePromises = Object.entries(addresses).map(
      async ([chainId, address]) => {
        try {
          const chainConfig = SUPPORTED_CHAINS[chainId];
          if (!chainConfig || !address) return;

          balances[chainId] = {};

          // Fetch native token balance
          try {
            let nativeBalance = "0";
            let nativeSymbol = chainConfig.nativeCurrency?.symbol || "";
            let nativeName = chainConfig.name;

            if (chainConfig.type === "EVM") {
              nativeBalance = await getNativeBalance(chainId, address);
            } else if (chainId === "solana") {
              const connection = new Connection(
                chainConfig.rpcUrl || "https://api.mainnet-beta.solana.com"
              );
              const publicKey = new PublicKey(address);
              const solBalance = await connection.getBalance(publicKey);
              nativeBalance = (solBalance / 1e9).toFixed(9);
            } else if (chainId === "bitcoin" || chainId === "sui") {
              // Bitcoin and Sui balances would need their respective SDKs
              nativeBalance = "0";
            }

            // Get native token price
            const nativePrice = await getNativeTokenPrice(chainId);
            const nativeUsdValue = parseFloat(nativeBalance) * nativePrice;

            if (parseFloat(nativeBalance) > 0) {
              balances[chainId]["native"] = {
                balance: nativeBalance,
                usdValue: nativeUsdValue,
                symbol: nativeSymbol,
                name: nativeName,
                address: "native",
              };
            }
          } catch (error) {
            console.error(`Error fetching native balance for ${chainId}:`, error);
          }

          // For EVM chains: Discover all ERC20 tokens
          if (chainConfig.type === "EVM") {
            try {
              // For Base chain: Use Basescan API (most reliable)
              if (chainId === "base") {
                console.log(`[Base] Starting token discovery for address: ${address}`);
                
                // Always check SEND token directly first (most reliable)
                try {
                  console.log(`[Base] Checking SEND token directly: ${SEND_TOKEN_ADDRESS}`);
                  const sendTokenInfo = await getERC20Balance(
                    chainId,
                    address,
                    SEND_TOKEN_ADDRESS
                  );
                  console.log(`[Base] SEND token balance check result:`, sendTokenInfo);
                  
                  if (parseFloat(sendTokenInfo.balance) > 0) {
                    console.log(`[Base] Fetching price for SEND token...`);
                    const price = await getTokenPriceByAddress(SEND_TOKEN_ADDRESS, chainId);
                    const usdValue = parseFloat(sendTokenInfo.balance) * price;
                    
                    console.log(`[Base] SEND token price result: $${price}, USD Value: $${usdValue}`);
                    
                    balances[chainId][SEND_TOKEN_ADDRESS.toLowerCase()] = {
                      balance: sendTokenInfo.balance,
                      usdValue,
                      symbol: sendTokenInfo.symbol,
                      name: sendTokenInfo.name,
                      address: SEND_TOKEN_ADDRESS.toLowerCase(),
                    };
                    
                    console.log(`[Base] SEND token added - Balance: ${sendTokenInfo.balance}, Price: $${price}, USD: $${usdValue}`);
                  } else {
                    console.log(`[Base] SEND token balance is 0`);
                  }
                } catch (error) {
                  console.error(`[Base] Error checking SEND token directly:`, error);
                }

                // Also try Basescan for other tokens
                const basescanTokens = await discoverBaseTokensFromBasescan(address);
                console.log(`[Base] Basescan found ${basescanTokens.length} tokens`);

                // Get prices and add to balances (skip SEND if already added)
                for (const token of basescanTokens) {
                  const tokenAddressLower = token.address.toLowerCase();
                  const sendAddressLower = SEND_TOKEN_ADDRESS.toLowerCase();
                  
                  // Skip if SEND token already added via direct check
                  if (tokenAddressLower === sendAddressLower && balances[chainId][tokenAddressLower]) {
                    console.log(`[Base] Skipping SEND token from Basescan (already added via direct check)`);
                    continue;
                  }
                  
                  try {
                    const price = await getTokenPriceByAddress(token.address, chainId);
                    const usdValue = parseFloat(token.balance) * price;

                    balances[chainId][token.address] = {
                      balance: token.balance,
                      usdValue,
                      symbol: token.symbol,
                      name: token.name,
                      address: token.address,
                    };

                    console.log(`[Base] Added token from Basescan: ${token.symbol} - Balance: ${token.balance}, USD: $${usdValue}`);
                  } catch (error) {
                    console.error(`[Base] Error getting price for ${token.symbol} (${token.address}):`, error);
                    // Still add token with 0 price so balance is visible
                    balances[chainId][token.address] = {
                      balance: token.balance,
                      usdValue: 0,
                      symbol: token.symbol,
                      name: token.name,
                      address: token.address,
                    };
                  }
                }

                console.log(`[Base] Final token count: ${Object.keys(balances[chainId] || {}).length}`);
                console.log(`[Base] Tokens in balances:`, Object.keys(balances[chainId] || {}));
              } else {
                // For other EVM chains: Use event scanning + common tokens
                const discoveredTokenAddresses = await discoverERC20TokensFromEvents(
                  chainId,
                  address
                );

                // Common tokens as fallback
                const commonTokens: Record<string, string[]> = {
                  ethereum: [
                    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
                    "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
                    "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
                    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
                  ],
                  polygon: [
                    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
                    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
                    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
                  ],
                };

                // Combine discovered tokens with common tokens
                const allTokenAddresses = [
                  ...new Set([
                    ...discoveredTokenAddresses,
                    ...(commonTokens[chainId] || []),
                  ]),
                ];

                // Discover tokens with balance > 0
                const discoveredTokens = await discoverERC20Tokens(
                  chainId,
                  address,
                  allTokenAddresses
                );

                // Get prices and add to balances
                for (const token of discoveredTokens) {
                  try {
                    const price = await getTokenPriceByAddress(token.address, chainId);
                    const usdValue = parseFloat(token.balance) * price;

                    balances[chainId][token.address] = {
                      balance: token.balance,
                      usdValue,
                      symbol: token.symbol,
                      name: token.name,
                      address: token.address,
                    };
                  } catch (error) {
                    console.error(`Error getting price for ${token.symbol} (${token.address}):`, error);
                    // Still add token with 0 price so balance is visible
                    balances[chainId][token.address] = {
                      balance: token.balance,
                      usdValue: 0,
                      symbol: token.symbol,
                      name: token.name,
                      address: token.address,
                    };
                  }
                }
              }
            } catch (error) {
              console.error(`Error discovering tokens for ${chainId}:`, error);
            }
          }

          // For Solana: Get all SPL tokens
          if (chainId === "solana") {
            try {
              const solanaTokens = await getAllSolanaTokens(
                address,
                chainConfig.rpcUrl || "https://api.mainnet-beta.solana.com"
              );

              // Get prices for each token
              for (const token of solanaTokens) {
                const price = await getTokenPriceByAddress(token.address, chainId);
                const usdValue = parseFloat(token.balance) * price;

                balances[chainId][token.address] = {
                  balance: token.balance,
                  usdValue,
                  symbol: token.symbol,
                  name: token.name,
                  address: token.address,
                };
              }
            } catch (error) {
              console.error(`Error fetching Solana tokens:`, error);
            }
          }
        } catch (error) {
          console.error(`Error processing ${chainId}:`, error);
        }
      }
    );

    await Promise.all(balancePromises);

    // Calculate total USD value across all chains and tokens
    let totalUSD = 0;
    Object.values(balances).forEach((chainBalances) => {
      Object.values(chainBalances).forEach((tokenBalance) => {
        totalUSD += tokenBalance.usdValue;
      });
    });

    // Simplified format for backward compatibility
    const simplifiedBalances: Record<
      string,
      { balance: string; usdValue: number; symbol: string }
    > = {};

    Object.entries(balances).forEach(([chainId, chainBalances]) => {
      const chainTotal = Object.values(chainBalances).reduce(
        (sum, token) => sum + token.usdValue,
        0
      );
      const nativeBalance = chainBalances["native"] || {
        balance: "0",
        usdValue: 0,
        symbol: SUPPORTED_CHAINS[chainId]?.nativeCurrency?.symbol || "",
      };

      simplifiedBalances[chainId] = {
        balance: nativeBalance.balance,
        usdValue: chainTotal,
        symbol: nativeBalance.symbol,
      };
    });

    // Create a flat structure for easier frontend consumption
    // This includes all tokens with their balances, even if price is 0
    const flatBalances: Record<
      string,
      { balance: string; usdValue: number; symbol: string; name: string; address: string }
    > = {};

    Object.entries(balances).forEach(([chainId, chainBalances]) => {
      Object.entries(chainBalances).forEach(([tokenAddress, tokenInfo]) => {
        // Use chainId:tokenAddress as key for unique identification
        const key = `${chainId}:${tokenAddress}`;
        flatBalances[key] = {
          ...tokenInfo,
          address: tokenAddress,
        };
      });
    });

    // Log final response for debugging
    console.log(`[Balances API] Final response - Total USD: $${totalUSD}`);
    console.log(`[Balances API] Chains with balances:`, Object.keys(balances));
    Object.entries(balances).forEach(([chainId, chainBalances]) => {
      console.log(`[Balances API] ${chainId}: ${Object.keys(chainBalances).length} tokens`);
      Object.entries(chainBalances).forEach(([tokenAddress, tokenInfo]) => {
        console.log(`[Balances API]   - ${tokenInfo.symbol}: ${tokenInfo.balance} ($${tokenInfo.usdValue})`);
      });
    });

    const response = NextResponse.json({
      success: true,
      balances, // Full nested structure: { chainId: { tokenAddress: {...} } }
      flatBalances, // Flat structure for easier frontend access
      simplifiedBalances, // Backward compatible format
      totalUSD,
      addresses,
    });

    response.headers.set(
      "Cache-Control",
      "private, s-maxage=15, stale-while-revalidate=30"
    );

    return response;
  } catch (error: any) {
    console.error("Error fetching wallet balances:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
