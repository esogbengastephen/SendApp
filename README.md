# Send Token Purchase Platform

A Next.js web application that allows users to purchase $SEND tokens on the Base blockchain using Nigerian Naira (NGN) via Paystack.

## Features

- 💰 Deposit Naira and receive $SEND tokens
- 🔗 Support for Base wallet addresses and SendTags
- 🔐 Secure payment processing via Paystack
- ⚡ Automatic token distribution from liquidity pool
- 🎨 Modern, responsive UI with dark mode support

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Paystack account and API keys
- Base network RPC access
- Liquidity pool wallet with $SEND tokens

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
- Paystack secret and public keys (see [PAYSTACK_SETUP.md](./PAYSTACK_SETUP.md) for detailed setup)
- Base RPC URL
- Liquidity pool private key (keep secure!)
- Exchange rate configuration

**📖 For detailed Paystack setup and testing instructions, see [PAYSTACK_SETUP.md](./PAYSTACK_SETUP.md)**

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── paystack/     # Paystack integration
│   │   ├── sendtag/      # SendTag resolution
│   │   └── rate/         # Exchange rate API
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   └── PaymentForm.tsx   # Main payment form
├── lib/                  # Library code
│   └── constants.ts      # App constants
└── utils/                # Utility functions
    └── validation.ts     # Input validation
```

## Environment Variables

See `.env.local.example` for all required environment variables.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Security Notes

- Never commit `.env.local` or private keys to version control
- Use environment variables for all sensitive data
- Verify Paystack webhook signatures
- Implement rate limiting on API routes
- Validate all user inputs

## License

ISC

