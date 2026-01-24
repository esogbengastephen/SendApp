# Send Token Purchase Platform

A Next.js web application that allows users to purchase $SEND tokens on the Base blockchain using Nigerian Naira (NGN) via Paystack.

## Features

- 💰 Deposit Naira and receive $SEND tokens
- 🔗 Support for Base wallet addresses and SendTags
- 🔐 Secure payment processing via Paystack
- ⚡ Automatic token distribution from liquidity pool
- 🎨 Modern, responsive UI with dark mode support
- 👨‍💼 Admin dashboard with wallet authentication
- 📊 Analytics and transaction management

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Paystack account and API keys
- Base network RPC access
- Liquidity pool wallet with $SEND tokens
- Supabase account (optional, for admin wallet management)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/esogbengastephen/SendApp.git
cd SendApp
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your actual values:
- Paystack secret and public keys (see [PAYSTACK_SETUP.md](./PAYSTACK_SETUP.md))
- Base RPC URL
- Liquidity pool private key (keep secure!)
- Exchange rate configuration
- Supabase credentials (optional)
- Admin wallet addresses

**📖 For detailed documentation, see [DOCUMENTATION.md](./DOCUMENTATION.md)**

**Quick Setup Links:**
- [Setup Guides](./docs/setup/) - All setup and configuration
- [Paystack Setup](./docs/setup/PAYSTACK_SETUP.md) - Payment integration
- [Admin Dashboard Setup](./docs/setup/ADMIN_SETUP.md) - Admin authentication

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── admin/             # Admin dashboard
│   │   ├── transactions/  # Transaction management
│   │   ├── payments/      # Payment verification
│   │   ├── token-distribution/ # Token distribution monitoring
│   │   └── settings/      # Settings management
│   ├── api/               # API routes
│   │   ├── admin/        # Admin APIs
│   │   ├── paystack/     # Paystack integration
│   │   ├── sendtag/      # SendTag resolution
│   │   └── rate/         # Exchange rate API
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── PaymentForm.tsx   # Main payment form
│   ├── AdminAuthGuard.tsx # Admin authentication guard
│   └── WalletConnect.tsx # Wallet connection component
├── lib/                  # Library code
│   ├── constants.ts      # App constants
│   ├── supabase.ts      # Supabase client
│   └── wallet-auth.ts   # Wallet authentication
└── utils/                # Utility functions
    └── validation.ts     # Input validation
```

## Environment Variables

See `.env.local.example` for all required environment variables.

Required:
- `PAYSTACK_SECRET_KEY` - Paystack secret key
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` - Paystack public key
- `LIQUIDITY_POOL_PRIVATE_KEY` - Private key for token distribution
- `NEXT_PUBLIC_ADMIN_WALLETS` - Comma-separated admin wallet addresses

Optional:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Admin Dashboard

Access the admin dashboard at `/admin`. You'll need to:
1. Connect your Base wallet
2. Sign the authentication message
3. Ensure your wallet is in the admin list

See [ADMIN_SETUP.md](./docs/setup/ADMIN_SETUP.md) for detailed setup instructions.

## 📚 Documentation

Comprehensive documentation is organized in the `docs/` folder:

- **[Complete Documentation Index](./DOCUMENTATION.md)** - Full documentation catalog
- **[Setup & Configuration](./docs/setup/)** - Initial setup guides
- **[User Guides](./docs/guides/)** - Feature guides and best practices
- **[Troubleshooting](./docs/troubleshooting/)** - Problem-solving guides
- **[Migration](./docs/migration/)** - Database and system migrations
- **[Deployment](./docs/deployment/)** - Deployment instructions
- **[Implementation](./docs/implementation/)** - Technical implementation details

### Quick Documentation Links

| Category | Description | Link |
|----------|-------------|------|
| 🚀 Setup | Initial configuration and setup | [docs/setup/](./docs/setup/) |
| 📖 Guides | Feature guides and tutorials | [docs/guides/](./docs/guides/) |
| 🔧 Troubleshooting | Fix common issues | [docs/troubleshooting/](./docs/troubleshooting/) |
| 🚢 Deployment | Deploy to production | [docs/deployment/](./docs/deployment/) |

## Security Notes

- Never commit `.env.local` or private keys to version control
- Use environment variables for all sensitive data
- Verify Paystack webhook signatures
- Implement rate limiting on API routes
- Validate all user inputs
- Regularly review admin wallet access

## License

ISC
# Build trigger
