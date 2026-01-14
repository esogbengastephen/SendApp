/**
 * Logo utilities for chains and tokens
 * Centralized logo URLs for consistent display across the app
 */

/**
 * Get chain logo URL by chain ID
 */
export function getChainLogo(chainId: string): string {
  const logos: Record<string, string> = {
    bitcoin: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    ethereum: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    base: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979509/108554348_rdxd9x.png", // Base custom logo from Cloudinary
    polygon: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
    solana: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    sui: "https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg",
    monad: "https://academy-public.coinmarketcap.com/optimized-uploads/03c033c8d1f948ce8ee9420212efcc5d.jpg", // Monad official logo from CoinMarketCap
  };
  return logos[chainId.toLowerCase()] || "";
}

/**
 * Get token logo URL by token symbol
 */
export function getTokenLogo(tokenSymbol: string): string {
  const logos: Record<string, string> = {
    // SEND Token - custom logo
    SEND: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1766979129/71a616bbd4464dfc8c7a5dcb4b3ee043_fe2oeg.png",
    // Stablecoins
    USDC: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
    USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
    // Native tokens
    ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    BTC: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",
    MATIC: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png",
    SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
    SUI: "https://assets.coingecko.com/coins/images/26375/small/sui_asset.jpeg",
    MON: "https://academy-public.coinmarketcap.com/optimized-uploads/03c033c8d1f948ce8ee9420212efcc5d.jpg", // Monad
  };
  return logos[tokenSymbol.toUpperCase()] || "";
}

/**
 * Get betting network logo URL by network name
 */
export function getBettingNetworkLogo(networkName: string): string {
  const logos: Record<string, string> = {
    Bet9ja: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289438/download_8_bocci9.png",
    SportyBet: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289438/download_10_dicwfi.png",
    "1xBet": "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289438/download_11_r48bza.png",
    NairaBet: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289439/download_12_wqcc8c.png",
    MerryBet: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289453/download_13_i0zbbb.png",
    Betway: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289438/download_6_vvgxte.png",
    BetKing: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289438/download_7_xo3az7.png",
  };
  return logos[networkName] || "";
}

/**
 * Get telecom network logo URL by network name
 */
export function getTelecomNetworkLogo(networkName: string): string {
  const logos: Record<string, string> = {
    MTN: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289438/download_fvgypa.png",
    Airtel: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289437/download_1_ickta4.png",
    Glo: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289437/download_1_exgdsl.jpg",
    "9mobile": "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289453/download_2_bp7ocu.png",
  };
  return logos[networkName] || "";
}

/**
 * Get TV network logo URL by network name
 */
export function getTVNetworkLogo(networkName: string): string {
  const logos: Record<string, string> = {
    DStv: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289437/download_3_lhixsz.png",
    GOtv: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289438/download_5_mfltnl.png",
    Startimes: "https://res.cloudinary.com/dshqnkjqb/image/upload/v1768289437/download_2_p2jtl1.jpg",
  };
  return logos[networkName] || "";
}

/**
 * Get gift card network logo URL by network name
 * Uses actual brand logos from reliable CDN sources
 */
export function getGiftCardNetworkLogo(networkName: string): string {
  const logos: Record<string, string> = {
    // Amazon - official logo
    Amazon: "https://logos-world.net/wp-content/uploads/2020/04/Amazon-Logo.png",
    
    // iTunes - Apple logo variant
    iTunes: "https://logos-world.net/wp-content/uploads/2020/06/iTunes-Logo.png",
    
    // Google Play - official logo
    "Google Play": "https://logos-world.net/wp-content/uploads/2020/11/Google-Play-Logo.png",
    
    // Steam - official logo
    Steam: "https://logos-world.net/wp-content/uploads/2020/11/Steam-Logo.png",
    
    // Xbox - official logo
    Xbox: "https://logos-world.net/wp-content/uploads/2020/06/Xbox-Logo.png",
    
    // PlayStation - official logo
    PlayStation: "https://logos-world.net/wp-content/uploads/2020/06/PlayStation-Logo.png",
    
    // Netflix - official logo
    Netflix: "https://logos-world.net/wp-content/uploads/2020/04/Netflix-Logo.png",
    
    // Spotify - official logo
    Spotify: "https://logos-world.net/wp-content/uploads/2020/09/Spotify-Logo.png",
    
    // Additional common gift card brands
    "Apple Store": "https://logos-world.net/wp-content/uploads/2020/04/Apple-Logo.png",
    "Nintendo eShop": "https://logos-world.net/wp-content/uploads/2020/06/Nintendo-Logo.png",
    "Razer Gold": "https://logos-world.net/wp-content/uploads/2021/02/Razer-Logo.png",
    "Sephora": "https://logos-world.net/wp-content/uploads/2020/11/Sephora-Logo.png",
    "Best Buy": "https://logos-world.net/wp-content/uploads/2020/04/Best-Buy-Logo.png",
    "Walmart": "https://logos-world.net/wp-content/uploads/2020/05/Walmart-Logo.png",
    "Target": "https://logos-world.net/wp-content/uploads/2020/05/Target-Logo.png",
    "eBay": "https://logos-world.net/wp-content/uploads/2020/06/eBay-Logo.png",
    "Uber": "https://logos-world.net/wp-content/uploads/2020/05/Uber-Logo.png",
    "Uber Eats": "https://logos-world.net/wp-content/uploads/2020/05/Uber-Eats-Logo.png",
    "Airbnb": "https://logos-world.net/wp-content/uploads/2020/06/Airbnb-Logo.png",
    "Discord": "https://logos-world.net/wp-content/uploads/2020/12/Discord-Logo.png",
    "Twitch": "https://logos-world.net/wp-content/uploads/2020/06/Twitch-Logo.png",
    "Roblox": "https://logos-world.net/wp-content/uploads/2021/08/Roblox-Logo.png",
    "Fortnite": "https://logos-world.net/wp-content/uploads/2021/08/Fortnite-Logo.png",
  };
  return logos[networkName] || "";
}
