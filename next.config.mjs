/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cryptologos.cc',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'academy-public.coinmarketcap.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: [
      '@mysten/sui',
      '@solana/web3.js',
      'ethers',
      'viem',
      'wagmi',
      'recharts',
      '@tanstack/react-query',
    ],
  },
  // Turbopack configuration (Next.js 16 uses Turbopack by default)
  turbopack: {
    // Resolve aliases for packages with subpath exports
    resolveAlias: {
      // Fix for @scure/bip39 wordlists resolution in Turbopack
      '@scure/bip39/wordlists/english': '@scure/bip39/wordlists/english.js',
    },
  },
};

export default nextConfig;

