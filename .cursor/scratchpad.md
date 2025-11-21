# SwitcherFi - Send Token Purchase Platform

## Background and Motivation

We are building a Next.js web application that allows users to purchase $SEND tokens on the Base blockchain using Nigerian Naira (NGN) via Paystack. The platform will:

- Accept NGN deposits through Paystack
- Support both Base wallet addresses and SendTags for token delivery
- Generate unique transaction IDs for each payment session
- Automatically distribute $SEND tokens from a liquidity pool after payment verification
- Provide a clean, modern UI matching the provided design

**Key Information:**
- $SEND Token Contract: `0x3f14920c99beb920afa163031c4e47a3e03b3e4a`
- Blockchain: Base (Ethereum L2)
- Payment Provider: Paystack
- Token Symbol: $SEND

## Key Challenges and Analysis

### 1. **Payment Verification Flow**
   - Challenge: Ensuring secure verification of Paystack payments before token distribution
   - Solution: Implement webhook endpoint to receive Paystack payment confirmations, verify transaction status, and trigger token distribution

### 2. **Wallet Address vs SendTag Resolution**
   - Challenge: Supporting both Base wallet addresses (0x...) and SendTags (@username)
   - Solution: Create a resolver function that checks if input is a wallet address or SendTag, and resolves SendTag to wallet address via Send API

### 3. **Unique Transaction ID Generation**
   - Challenge: Generating unique IDs per page load/session
   - Solution: Use UUID or nanoid on page load, store in session/localStorage, and associate with Paystack transaction reference

### 4. **Token Distribution Security**
   - Challenge: Preventing double-spending and ensuring only verified payments trigger token transfers
   - Solution: Maintain a database/state of processed transactions, verify payment status with Paystack API, and use smart contract with proper access controls

### 5. **Exchange Rate Calculation**
   - Challenge: Calculating NGN to $SEND conversion rate
   - Solution: Fetch current rate from DEX (Uniswap on Base) or maintain a configurable rate, update UI in real-time

### 6. **Base Blockchain Integration**
   - Challenge: Interacting with Base network and $SEND token contract
   - Solution: Use ethers.js or viem, configure Base RPC endpoints, handle token transfers via contract interaction

## High-level Task Breakdown

### Phase 1: Project Setup & Infrastructure
- [x] Initialize Next.js project with TypeScript
- [x] Set up project structure (components, pages, utils, lib)
- [x] Configure Tailwind CSS with custom theme matching design
- [x] Set up environment variables (.env.local.example)
- [x] Install dependencies (ethers/viem, Paystack SDK, nanoid, etc.)

### Phase 2: UI Implementation
- [x] Create main payment form component matching provided HTML design
- [x] Implement dark mode support (DarkModeToggle component)
- [x] Add form validation (amount, wallet address/SendTag)
- [x] Implement real-time $SEND amount calculation (with API integration)
- [x] Add copy-to-clipboard functionality for deposit account (with toast notifications)
- [x] Create loading states and success/error modals (Modal & Toast components)

### Phase 3: Backend API Routes
- [ ] Create `/api/paystack/initialize` - Initialize Paystack transaction
- [ ] Create `/api/paystack/verify` - Verify payment status
- [ ] Create `/api/paystack/webhook` - Handle Paystack webhook callbacks
- [ ] Create `/api/sendtag/resolve` - Resolve SendTag to wallet address
- [ ] Create `/api/rate` - Get current NGN to $SEND exchange rate

### Phase 4: Blockchain Integration
- [ ] Set up Base network configuration
- [ ] Create contract interaction utilities for $SEND token
- [ ] Implement token transfer function (from liquidity pool)
- [ ] Add transaction status tracking
- [ ] Handle gas estimation and error handling

### Phase 5: Payment Flow Implementation
- [ ] Generate unique transaction ID on page load
- [ ] Implement Paystack payment initialization
- [ ] Handle payment callback/redirect
- [ ] Verify payment with Paystack API
- [ ] Trigger token distribution after verification
- [ ] Store transaction records (database or state management)

### Phase 6: SendTag Integration
- [ ] Research Send API for SendTag resolution
- [ ] Implement SendTag to wallet address resolver
- [ ] Add validation for both wallet addresses and SendTags
- [ ] Handle resolution errors gracefully

### Phase 7: Testing & Security
- [ ] Test payment flow end-to-end
- [ ] Test token distribution on Base testnet
- [ ] Implement rate limiting on API routes
- [ ] Add input sanitization and validation
- [ ] Test webhook security (verify Paystack signature)
- [ ] Test edge cases (failed payments, network errors, etc.)

### Phase 8: Deployment Preparation
- [ ] Set up production environment variables
- [ ] Configure Base mainnet RPC
- [ ] Set up Paystack production keys
- [ ] Deploy to Vercel or preferred hosting
- [ ] Test production deployment

## Project Status Board

### Current Status / Progress Tracking
- **Status**: Executor Mode - Implementation Phase
- **Current Phase**: Phase 1 - COMPLETED ✅ | Phase 2 - COMPLETED ✅ | Phase 3 - Ready to Start
- **Next Steps**: Begin Phase 3 - Backend API Routes (Paystack integration, webhook handling)

### Executor's Feedback or Assistance Requests
- ✅ Phase 1 Complete: Next.js project initialized with TypeScript, Tailwind CSS configured, project structure created
- ✅ Phase 2 Complete: 
  - Dark mode toggle implemented
  - Form validation for wallet addresses/SendTags and amounts
  - Real-time exchange rate API endpoint created
  - Modal and Toast components for user feedback
  - Enhanced PaymentForm with error handling and validation
- ✅ Build successful - project compiles without errors
- 📝 Ready to proceed with Phase 3: Implement Paystack API routes and payment flow

## Security Review & Audit Notes

### Smart Contract Considerations
- ⚠️ **Pending Review**: Token distribution contract needs audit
- ⚠️ **Access Control**: Ensure only authorized addresses can trigger token transfers
- ⚠️ **Reentrancy**: Implement checks-effects-interactions pattern
- ⚠️ **Rate Limiting**: Prevent abuse of payment verification endpoints

### API Security
- ⚠️ **Webhook Verification**: Must verify Paystack webhook signatures
- ⚠️ **Transaction Deduplication**: Prevent double token distribution
- ⚠️ **Input Validation**: Sanitize all user inputs (wallet addresses, amounts)
- ⚠️ **CORS**: Configure proper CORS for API routes

## Lessons

_No lessons recorded yet_

## Technical Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Blockchain**: Base (Ethereum L2)
- **Web3 Library**: ethers.js or viem
- **Payment**: Paystack
- **State Management**: React hooks / Zustand (if needed)
- **Database**: (TBD - may need for transaction tracking)

## Environment Variables Required

```
# Base Network
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_SEND_TOKEN_ADDRESS=0x3f14920c99beb920afa163031c4e47a3e03b3e4a

# Paystack
PAYSTACK_SECRET_KEY=sk_xxx
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_xxx

# Liquidity Pool Wallet (private key or address for token distribution)
LIQUIDITY_POOL_PRIVATE_KEY=xxx
# OR use a more secure method like environment-based wallet management

# Exchange Rate (or fetch from DEX)
SEND_NGN_EXCHANGE_RATE=xxx

# Send API (if available)
SEND_API_KEY=xxx
SEND_API_URL=xxx
```

