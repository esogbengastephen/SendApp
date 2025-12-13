# SwitcherFi - Send Token Purchase Platform

## Background and Motivation

We are building a Next.js web application that allows users to purchase $SEND tokens on the Base blockchain using Nigerian Naira (NGN) via Paystack. The platform will:

- Accept NGN deposits through Paystack
- Support both Base wallet addresses and SendTags for token delivery
- Generate unique transaction IDs for each payment session
- Automatically distribute $SEND tokens from a liquidity pool after payment verification
- Provide a clean, modern UI matching the provided design

**Key Information:**
- $SEND Token Contract: `0xEab49138BA2Ea6dd776220fE26b7b8E446638956`
- Blockchain: Base (Ethereum L2)
- Payment Provider: Paystack
- Token Symbol: $SEND

## Project Status Board

### Current Status / Progress Tracking
- **Status**: ✅ **CORE FUNCTIONALITY COMPLETE** - Production Ready (with in-memory storage)
- **Current Phase**: Phase 1-6 COMPLETED ✅ | Phase 7-8 IN PROGRESS
- **Last Updated**: Admin dashboard now uses real data from transactions

### Completed Features ✅
- ✅ Phase 1: Project Setup & Infrastructure
- ✅ Phase 2: UI Implementation (dark mode, validation, modals)
- ✅ Phase 3: Backend API Routes (Paystack, SendTag, rate)
- ✅ Phase 4: Blockchain Integration (Base network, token transfers)
- ✅ Phase 5: Payment Flow (unique IDs, verification, token distribution)
- ✅ Phase 6: SendTag Integration (format `/username`, autocomplete, resolution)
- ✅ Admin Dashboard (wallet auth, stats, transactions, payments, token distribution)
- ✅ Real-time exchange rate updates
- ✅ Duplicate payment prevention
- ✅ Transaction lifecycle management

### Current Limitations ⚠️
1. **In-Memory Storage**: Transactions are stored in memory (lost on server restart)
2. **No Database**: Settings and transactions are not persisted
3. **No Idempotency Key**: Paystack idempotency not integrated
4. **Transaction ID Storage**: Only stored in localStorage, not in database

## 📋 ENHANCED PAYMENT HANDLING PLAN

### Objective
Enhance the payment handling process with:
1. Unique transaction ID generation and storage (local + database)
2. Paystack idempotency key integration to prevent double funding
3. Enhanced payment verification against transaction ID
4. Comprehensive admin dashboard with transaction tracking

---

## Phase 1: Transaction ID Management Enhancement

### 1.1 Frontend Transaction ID Generation & Storage

**Current State:**
- ✅ Transaction IDs generated using `nanoid()` on component mount
- ✅ Stored in `localStorage` for persistence
- ❌ Not stored in database immediately

**Enhancement Required:**
- [ ] **Generate Transaction ID Earlier**: Generate ID when user inputs NGN amount (not just on mount)
- [ ] **Store in Database Immediately**: Create API endpoint to store transaction ID in database when generated
- [ ] **Sync with localStorage**: Ensure localStorage and database stay in sync
- [ ] **Handle Page Refresh**: If transaction ID exists in localStorage, check if it exists in database

**Implementation Steps:**
1. **Update `components/PaymentForm.tsx`**:
   - Generate transaction ID when user first inputs NGN amount (not on mount)
   - Call new API endpoint `/api/transactions/create-id` to store in database
   - Store in localStorage as backup
   - Handle case where ID already exists in database

2. **Create New API Endpoint** (`app/api/transactions/create-id/route.ts`):
   ```typescript
   POST /api/transactions/create-id
   Body: { transactionId: string, ngnAmount?: number }
   Response: { success: boolean, transactionId: string, exists: boolean }
   ```
   - Check if transaction ID already exists
   - If exists, return existing transaction
   - If not, create new pending transaction record
   - Return transaction status

3. **Update Transaction Interface** (`lib/transactions.ts`):
   - Add `idempotencyKey` field (same as transactionId)
   - Add `initializedAt` timestamp
   - Add `lastCheckedAt` timestamp for payment verification attempts

**Files to Modify:**
- `components/PaymentForm.tsx`
- `lib/transactions.ts` (add new fields)
- `app/api/transactions/create-id/route.ts` (new file)

---

## Phase 2: Paystack Idempotency Key Integration

### 2.1 Understanding Paystack Idempotency

**Paystack Idempotency Mechanism:**
- Paystack supports idempotency via `Idempotency-Key` header
- When same idempotency key is used, Paystack returns the same response
- Prevents duplicate charges for the same request
- Key must be unique per transaction

**Current State:**
- ❌ Not using Paystack's initialize endpoint (using manual bank transfers)
- ❌ No idempotency key implementation
- ✅ Using transaction ID for internal tracking

**Enhancement Strategy:**
Since we're using manual bank transfers (not Paystack's payment initialization), we need to implement idempotency at the application level:

1. **Use Transaction ID as Idempotency Key**: 
   - Transaction ID serves as our idempotency key
   - Store in database with unique constraint
   - Prevent duplicate processing of same transaction ID

2. **Database-Level Idempotency**:
   - Add unique constraint on `transaction_id` in database
   - Check transaction ID before processing payment
   - Return existing result if transaction ID already processed

3. **Payment Verification Idempotency**:
   - When verifying payment, check if transaction ID already completed
   - If completed, return existing result (don't process again)
   - If pending, proceed with verification

### 2.2 Implementation Steps

**Step 1: Update Transaction Storage**
- [ ] Add `idempotencyKey` field to Transaction interface
- [ ] Set `idempotencyKey = transactionId` when creating transaction
- [ ] Add database unique constraint on `transaction_id` (when migrating to database)

**Step 2: Update Payment Processing**
- [ ] In `/api/paystack/process-payment`, check idempotency first:
  ```typescript
  // Check if transaction ID already processed
  const existing = getTransaction(transactionId);
  if (existing?.status === "completed") {
    return { success: true, alreadyProcessed: true, ...existing };
  }
  ```

**Step 3: Add Idempotency Check Middleware**
- [ ] Create middleware function `checkIdempotency(transactionId)`
- [ ] Use in all payment-related endpoints
- [ ] Return cached result if already processed

**Files to Modify:**
- `lib/transactions.ts` (add idempotencyKey field and checks)
- `app/api/paystack/process-payment/route.ts` (add idempotency checks)
- `app/api/paystack/webhook/route.ts` (add idempotency checks)
- `lib/paystack.ts` (if we add Paystack initialize endpoint later)

---

## Phase 3: Enhanced Payment Verification

### 3.1 Three-Point Verification System

**Current State:**
- ✅ Verifies payment amount
- ✅ Verifies payment status (success)
- ✅ Verifies payment time (recent, within 10 minutes)
- ✅ Checks Paystack reference uniqueness
- ❌ Doesn't explicitly verify against transaction ID in all cases

**Enhancement Required:**
Implement strict three-point verification before token distribution:

1. **Point 1: Transaction ID Verification**
   - [ ] Verify transaction ID exists in database
   - [ ] Verify transaction ID status is "pending" (not already completed)
   - [ ] Verify transaction ID matches the payment being verified

2. **Point 2: Payment Amount Verification**
   - [ ] Verify Paystack payment amount matches transaction NGN amount (exact match)
   - [ ] Verify amount is in correct format (kobo)
   - [ ] Log amount mismatch for debugging

3. **Point 3: Payment Status & Uniqueness Verification**
   - [ ] Verify Paystack payment status is "success"
   - [ ] Verify Paystack reference hasn't been used by another transaction
   - [ ] Verify payment was made after transaction creation
   - [ ] Verify payment is recent (within time window)

**Implementation Steps:**

**Step 1: Create Verification Function**
```typescript
// lib/payment-verification.ts
export async function verifyPaymentForTransaction(
  transactionId: string,
  paystackReference: string
): Promise<{
  valid: boolean;
  transaction?: Transaction;
  paystackTx?: any;
  errors: string[];
}>
```

**Step 2: Update Payment Processing Endpoint**
- [ ] Use verification function in `/api/paystack/process-payment`
- [ ] Only proceed with token distribution if all three points pass
- [ ] Return detailed error messages for each failed point

**Step 3: Add Verification Logging**
- [ ] Log each verification point result
- [ ] Store verification attempts in database
- [ ] Track verification failures for debugging

**Files to Create/Modify:**
- `lib/payment-verification.ts` (new file - verification logic)
- `app/api/paystack/process-payment/route.ts` (use verification function)
- `app/api/paystack/webhook/route.ts` (use verification function)
- `lib/transactions.ts` (add verification attempt tracking)

---

## Phase 4: Admin Dashboard Enhancements

### 4.1 Comprehensive Transaction List

**Current State:**
- ✅ Admin dashboard shows transactions
- ✅ Filtering by status, date, amount, search
- ✅ Shows transaction ID, wallet, amount, status
- ❌ Doesn't clearly show idempotency status
- ❌ Doesn't show verification attempt history
- ❌ Limited transaction details

**Enhancement Required:**

**4.1.1 Transaction List Enhancements**
- [ ] **Add Idempotency Status Column**: Show if transaction was processed with idempotency
- [ ] **Add Verification Status**: Show verification attempts and results
- [ ] **Add Paystack Reference Link**: Clickable link to Paystack transaction
- [ ] **Add Blockchain TX Link**: Clickable link to BaseScan (if completed)
- [ ] **Add Transaction Timeline**: Show created → verified → completed timestamps
- [ ] **Add Retry Button**: Allow manual retry for failed transactions

**4.1.2 Transaction Details Modal**
- [ ] Create detailed transaction view modal
- [ ] Show all verification points and results
- [ ] Show payment verification history
- [ ] Show token distribution details
- [ ] Show error logs (if any)

**4.1.3 Enhanced Filtering & Sorting**
- [ ] Filter by idempotency status
- [ ] Filter by verification status
- [ ] Sort by verification attempts
- [ ] Export transactions to CSV/Excel

**4.1.4 Real-time Updates**
- [ ] Add WebSocket or polling for real-time status updates
- [ ] Show live transaction count
- [ ] Show pending transactions count
- [ ] Auto-refresh transaction list

### 4.2 Implementation Steps

**Step 1: Update Transaction Interface**
```typescript
interface Transaction {
  // ... existing fields
  idempotencyKey: string;
  verificationAttempts: number;
  lastVerificationAt?: Date;
  verificationHistory?: VerificationAttempt[];
  paystackTransactionUrl?: string;
  blockchainExplorerUrl?: string;
}
```

**Step 2: Update Admin Transactions Page**
- [ ] Add new columns to transaction table
- [ ] Create transaction details modal component
- [ ] Add real-time update mechanism
- [ ] Add export functionality

**Step 3: Create Verification History Component**
- [ ] Display verification attempts
- [ ] Show which verification points passed/failed
- [ ] Show timestamps for each attempt

**Files to Modify:**
- `app/admin/transactions/page.tsx`
- `lib/transactions.ts` (add new fields)
- `app/api/admin/transactions/route.ts` (include new fields)
- `components/TransactionDetailsModal.tsx` (new component)

---

## Phase 5: Database Migration (Prerequisite)

### 5.1 Database Schema for Enhanced Features

**Required Tables:**

**1. `transactions` Table:**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(255) UNIQUE NOT NULL, -- Idempotency key
  idempotency_key VARCHAR(255) UNIQUE NOT NULL, -- Same as transaction_id
  paystack_reference VARCHAR(255),
  wallet_address VARCHAR(255) NOT NULL,
  ngn_amount DECIMAL(18, 2) NOT NULL,
  send_amount VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  exchange_rate DECIMAL(18, 8),
  sendtag VARCHAR(255), -- If user used SendTag
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  initialized_at TIMESTAMP, -- When transaction ID was first created
  completed_at TIMESTAMP,
  last_checked_at TIMESTAMP, -- Last payment verification attempt
  verification_attempts INTEGER DEFAULT 0,
  tx_hash VARCHAR(255), -- Blockchain transaction hash
  error_message TEXT,
  metadata JSONB -- Additional data
);

CREATE INDEX idx_transactions_transaction_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_idempotency_key ON transactions(idempotency_key);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_paystack_reference ON transactions(paystack_reference);
```

**2. `verification_attempts` Table (for history):**
```sql
CREATE TABLE verification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id VARCHAR(255) NOT NULL REFERENCES transactions(transaction_id),
  attempt_number INTEGER NOT NULL,
  point_1_verified BOOLEAN, -- Transaction ID verification
  point_2_verified BOOLEAN, -- Amount verification
  point_3_verified BOOLEAN, -- Payment status & uniqueness
  all_points_verified BOOLEAN,
  paystack_reference VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_attempts_transaction_id ON verification_attempts(transaction_id);
```

### 5.2 Migration Steps

- [ ] Set up Supabase project (if not already done)
- [ ] Create migration files
- [ ] Run migrations
- [ ] Update `lib/transactions.ts` to use Supabase
- [ ] Test transaction creation/retrieval
- [ ] Migrate existing in-memory data (if any)

---

## Implementation Priority & Timeline

### 🔴 CRITICAL (Week 1)
1. **Transaction ID Database Storage** (Phase 1)
   - Store transaction IDs in database immediately
   - Sync with localStorage
   - Handle page refresh scenarios

2. **Idempotency Implementation** (Phase 2)
   - Add idempotency key to transactions
   - Prevent duplicate processing
   - Add idempotency checks to all payment endpoints

### 🟡 HIGH PRIORITY (Week 2)
3. **Enhanced Payment Verification** (Phase 3)
   - Implement three-point verification system
   - Create verification function
   - Add verification logging

4. **Database Migration** (Phase 5)
   - Set up Supabase
   - Create schema
   - Migrate transaction storage

### 🟢 MEDIUM PRIORITY (Week 3)
5. **Admin Dashboard Enhancements** (Phase 4)
   - Add idempotency status display
   - Add verification history
   - Add transaction details modal
   - Real-time updates

---

## Technical Implementation Details

### Transaction ID Generation Flow

```
User Inputs NGN Amount
    ↓
Generate Transaction ID (nanoid)
    ↓
Store in localStorage (backup)
    ↓
Call /api/transactions/create-id
    ↓
Store in Database (with idempotency key)
    ↓
Return transaction ID to frontend
    ↓
User completes payment
    ↓
Call /api/paystack/process-payment (with transaction ID)
    ↓
Check Idempotency (transaction ID already processed?)
    ↓
If not processed: Verify Payment (3 points)
    ↓
If verified: Distribute Tokens
    ↓
Update Transaction Status
```

### Idempotency Check Flow

```
Payment Processing Request
    ↓
Extract Transaction ID
    ↓
Query Database for Transaction ID
    ↓
If Transaction Exists:
    ├─ If Status = "completed": Return existing result (idempotent)
    ├─ If Status = "pending": Proceed with verification
    └─ If Status = "failed": Allow retry
    ↓
If Transaction Doesn't Exist:
    └─ Create new transaction (first time)
```

### Three-Point Verification Flow

```
Payment Verification Request
    ↓
Point 1: Transaction ID Verification
    ├─ Transaction ID exists? ✓
    ├─ Status is "pending"? ✓
    └─ Transaction ID matches? ✓
    ↓
Point 2: Amount Verification
    ├─ Paystack amount = Transaction amount? ✓
    ├─ Amount format correct? ✓
    └─ Amount in kobo? ✓
    ↓
Point 3: Payment Status & Uniqueness
    ├─ Paystack status = "success"? ✓
    ├─ Reference not used before? ✓
    ├─ Payment after transaction creation? ✓
    └─ Payment recent (within window)? ✓
    ↓
All Points Verified?
    ├─ Yes: Proceed with Token Distribution
    └─ No: Return Error with Details
```

---

## Testing Checklist

### Transaction ID Management
- [ ] Transaction ID generated when user inputs amount
- [ ] Transaction ID stored in database immediately
- [ ] Transaction ID synced with localStorage
- [ ] Page refresh preserves transaction ID
- [ ] Duplicate transaction ID creation prevented

### Idempotency
- [ ] Same transaction ID processed only once
- [ ] Duplicate requests return same result
- [ ] Idempotency key stored correctly
- [ ] Database unique constraint prevents duplicates

### Payment Verification
- [ ] Point 1 (Transaction ID) verified correctly
- [ ] Point 2 (Amount) verified correctly
- [ ] Point 3 (Status & Uniqueness) verified correctly
- [ ] All three points must pass before token distribution
- [ ] Failed verification points logged correctly

### Admin Dashboard
- [ ] All transactions displayed
- [ ] Idempotency status shown
- [ ] Verification history displayed
- [ ] Transaction details modal works
- [ ] Real-time updates work
- [ ] Export functionality works

---

## Files to Create/Modify

### New Files
1. `app/api/transactions/create-id/route.ts` - Store transaction ID in database
2. `lib/payment-verification.ts` - Three-point verification logic
3. `components/TransactionDetailsModal.tsx` - Transaction details view
4. `lib/database.ts` - Database connection and utilities (if using Supabase directly)

### Modified Files
1. `components/PaymentForm.tsx` - Generate ID on amount input, store in database
2. `lib/transactions.ts` - Add idempotency fields, database methods
3. `app/api/paystack/process-payment/route.ts` - Add idempotency checks, use verification function
4. `app/api/paystack/webhook/route.ts` - Add idempotency checks
5. `app/admin/transactions/page.tsx` - Enhanced transaction list
6. `app/api/admin/transactions/route.ts` - Include new fields in response

---

## Success Criteria

✅ **Transaction ID Management**
- Transaction IDs generated when user starts transaction
- Stored in both localStorage and database
- Persist across page refreshes

✅ **Idempotency**
- Each transaction ID processed only once
- Duplicate requests return same result
- No double funding for single payments

✅ **Payment Verification**
- All three verification points checked
- Tokens only sent if all points pass
- Detailed error messages for failures

✅ **Admin Dashboard**
- All transactions displayed with status
- Idempotency status clearly marked
- Verification history visible
- Easy tracking and verification

---

## Next Steps

1. **Start with Phase 1**: Implement transaction ID database storage
2. **Then Phase 2**: Add idempotency implementation
3. **Then Phase 3**: Enhance payment verification
4. **Finally Phase 4**: Update admin dashboard

**Ready to proceed with implementation?** Switch to Executor mode to begin Phase 1.

---

## 🚀 OFF-RAMP IMPLEMENTATION PLAN

### Background and Motivation

The off-ramp solution allows users to convert Base tokens (any token on Base ecosystem) back to Nigerian Naira (NGN). This is the reverse flow of the on-ramp:

**On-Ramp Flow:** NGN → $SEND Tokens
**Off-Ramp Flow:** Base Tokens → USDC → NGN

**Key Requirements:**
- Users enter account number where they want to receive Naira
- System generates unique wallet address for each transaction (HD Wallet derivation)
- User sends any Base token to that unique address
- System automatically swaps token to USDC (using 1inch DEX aggregator)
- System verifies admin wallet received USDC
- Only then: Paystack sends Naira to user's account number
- Same tiered fee system as on-ramp (configurable in admin)
- Admin-configurable min/max amounts
- Retry mechanism: retry → retry → manual review with refund option
- Continuous wallet monitoring until payment received

---

## Phase 1: Database Schema & Migration

### 1.1 Create Off-Ramp Transactions Table

**File:** `supabase/migrations/018_create_offramp_tables.sql`

**Implementation Steps:**
- [ ] Create migration file `018_create_offramp_tables.sql`
- [ ] Run migration in Supabase
- [ ] Verify tables created correctly
- [ ] Set up RLS policies (if needed)

**Schema:**
```sql
-- Off-ramp transactions table
CREATE TABLE IF NOT EXISTS offramp_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id), -- Link to existing users table
  user_email TEXT NOT NULL, -- User's email (for quick lookup)
  user_account_number VARCHAR(50) NOT NULL, -- Where to send Naira
  user_account_name TEXT, -- Optional: account name
  user_bank_code VARCHAR(10), -- Optional: bank code
  unique_wallet_address VARCHAR(255) UNIQUE NOT NULL, -- Generated HD wallet address
  token_address VARCHAR(255), -- Which token user sent (detected)
  token_symbol VARCHAR(50), -- Token symbol (ETH, USDC, etc.)
  token_amount VARCHAR(50), -- Amount sent (detected)
  token_amount_raw VARCHAR(50), -- Raw amount (wei format)
  usdc_amount VARCHAR(50), -- After swap to USDC
  usdc_amount_raw VARCHAR(50), -- Raw USDC amount
  ngn_amount DECIMAL(18, 2), -- Final NGN to pay user (after fees)
  exchange_rate DECIMAL(18, 8), -- USDC to NGN rate
  fee_ngn DECIMAL(18, 2), -- Fee in NGN
  fee_in_send TEXT, -- Fee in $SEND (for revenue tracking)
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'pending',           -- Waiting for user to send tokens
    'token_received',     -- Token detected, waiting for swap
    'swapping',          -- Swap in progress
    'usdc_received',     -- USDC received in admin wallet
    'paying',            -- Paystack payment in progress
    'completed',         -- User received Naira
    'failed',            -- Transaction failed
    'refunded'           -- Refunded to user
  )),
  swap_tx_hash VARCHAR(255), -- 1inch swap transaction hash
  swap_attempts INTEGER DEFAULT 0, -- Number of swap attempts
  paystack_reference VARCHAR(255), -- Paystack payment reference
  paystack_recipient_code VARCHAR(255), -- Paystack recipient code
  error_message TEXT, -- Error details if failed
  refund_tx_hash VARCHAR(255), -- If refunded, blockchain tx hash
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  token_received_at TIMESTAMP WITH TIME ZONE,
  usdc_received_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_transaction_id ON offramp_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_user_id ON offramp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_user_email ON offramp_transactions(user_email);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_wallet_address ON offramp_transactions(unique_wallet_address);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_status ON offramp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_offramp_transactions_created_at ON offramp_transactions(created_at);

-- Off-ramp revenue tracking (similar to on-ramp)
CREATE TABLE IF NOT EXISTS offramp_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  fee_ngn DECIMAL(18, 2) NOT NULL,
  fee_in_send TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_offramp_revenue_transaction FOREIGN KEY (transaction_id)
    REFERENCES offramp_transactions(transaction_id) ON DELETE CASCADE
);

-- Off-ramp swap attempts log (for retry tracking)
CREATE TABLE IF NOT EXISTS offramp_swap_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES offramp_transactions(transaction_id),
  attempt_number INTEGER NOT NULL,
  swap_tx_hash VARCHAR(255),
  status VARCHAR(20), -- pending, success, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offramp_swap_attempts_transaction_id ON offramp_swap_attempts(transaction_id);
```

---

## Phase 2: HD Wallet Setup & Configuration

### 2.1 Environment Variables

**File:** `.env.local` (add these)

```bash
# HD Wallet for Off-Ramp
OFFRAMP_MASTER_MNEMONIC="your 12-word mnemonic phrase here"
OFFRAMP_ADMIN_WALLET_ADDRESS="0x..." # Admin wallet to receive USDC
OFFRAMP_ADMIN_PRIVATE_KEY="0x..." # Private key for signing swaps (optional, use with caution)
```

### 2.2 HD Wallet Utility Library

**File:** `lib/offramp-wallet.ts` (NEW)

**Implementation Steps:**
- [ ] Install/verify `ethers` package (should already be installed)
- [ ] Create `lib/offramp-wallet.ts`
- [ ] Generate master mnemonic (use secure method)
- [ ] Store mnemonic in environment variables
- [ ] Test wallet generation
- [ ] Verify addresses are unique for different transaction IDs

**Key Functions:**
- `generateOfframpWallet(transactionId)` - Generate unique wallet address
- `getAdminWalletAddress()` - Get admin wallet address
- `verifyWalletDerivation(address, transactionId)` - Verify address derivation

---

## Phase 3: Frontend Off-Ramp Component

### 3.1 Create Off-Ramp Form Component

**File:** `components/OffRampForm.tsx` (NEW)

**Features:**
- Input field for account number (where user wants to receive Naira)
- Optional: Account name and bank selection
- "Generate Payment" button
- Display unique wallet address after generation
- Show transaction status
- Similar UI/UX to existing PaymentForm

**Key States:**
- `accountNumber` - User's bank account number
- `accountName` - Optional account name
- `bankCode` - Optional bank code
- `transactionId` - Generated transaction ID
- `uniqueWalletAddress` - Generated wallet address
- `status` - Transaction status
- `isLoading` - Loading states

**Implementation Steps:**
- [ ] Create `components/OffRampForm.tsx`
- [ ] Add form validation (account number format)
- [ ] Integrate with `/api/offramp/generate-address` endpoint
- [ ] Display unique wallet address prominently
- [ ] Add copy-to-clipboard functionality
- [ ] Show transaction status updates
- [ ] Add QR code for wallet address (optional)
- [ ] Style to match existing PaymentForm

### 3.2 Add Off-Ramp Route to Main App

**File:** `app/offramp/page.tsx` (NEW)

**Implementation Steps:**
- [ ] Create `app/offramp/page.tsx`
- [ ] Add authentication check
- [ ] Add navigation link in main layout
- [ ] Test routing

---

## Phase 4: Backend API Endpoints

### 4.1 Generate Unique Wallet Address

**File:** `app/api/offramp/generate-address/route.ts` (NEW)

**Endpoint:** `POST /api/offramp/generate-address`

**Request Body:**
```typescript
{
  accountNumber: string;
  accountName?: string;
  bankCode?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  transactionId: string;
  uniqueWalletAddress: string;
  message?: string;
}
```

**Logic:**
1. Verify user is logged in (get from session)
2. Generate unique transaction ID (nanoid)
3. Generate unique wallet address using HD wallet
4. Create offramp_transaction record in database
5. Return transaction ID and wallet address

**Implementation Steps:**
- [ ] Create API route
- [ ] Add authentication check
- [ ] Generate transaction ID
- [ ] Generate wallet address using HD wallet utility
- [ ] Store in database
- [ ] Return response
- [ ] Add error handling

### 4.2 Monitor Wallet for Tokens

**File:** `app/api/offramp/check-token/route.ts` (NEW)

**Endpoint:** `POST /api/offramp/check-token`

**Request Body:**
```typescript
{
  transactionId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  tokenDetected: boolean;
  tokenAddress?: string;
  tokenSymbol?: string;
  tokenAmount?: string;
  message?: string;
}
```

**Logic:**
1. Get transaction from database
2. Check unique wallet address balance on Base network
3. If tokens detected, identify which token
4. Update transaction status to "token_received"
5. Trigger swap process (or return token info)

**Implementation Steps:**
- [ ] Create API route
- [ ] Connect to Base RPC (Alchemy/Infura)
- [ ] Check wallet balance
- [ ] Detect token type (ERC20 or native ETH)
- [ ] Get token metadata (symbol, decimals)
- [ ] Update database
- [ ] Return token information

### 4.3 Swap Token to USDC

**File:** `app/api/offramp/swap-token/route.ts` (NEW)

**Endpoint:** `POST /api/offramp/swap-token`

**Request Body:**
```typescript
{
  transactionId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  swapTxHash?: string;
  usdcAmount?: string;
  message?: string;
}
```

**Logic:**
1. Get transaction from database
2. Verify token is received
3. Call 1inch API to get swap quote
4. Execute swap (token → USDC)
5. Send USDC to admin wallet (not user wallet)
6. Wait for USDC confirmation
7. Update transaction status

**1inch Integration:**
- Use 1inch Fusion API or Aggregation API
- Support any Base token → USDC
- Handle slippage
- Retry on failure (up to 2 retries)

**Implementation Steps:**
- [ ] Install 1inch SDK or use REST API
- [ ] Create swap utility function
- [ ] Get swap quote from 1inch
- [ ] Execute swap transaction
- [ ] Monitor swap status
- [ ] Verify USDC received in admin wallet
- [ ] Update database
- [ ] Implement retry logic

### 4.4 Process Paystack Payment

**File:** `app/api/offramp/process-payment/route.ts` (NEW)

**Endpoint:** `POST /api/offramp/process-payment`

**Request Body:**
```typescript
{
  transactionId: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  paystackReference?: string;
  ngnAmount?: number;
  message?: string;
}
```

**Logic:**
1. Get transaction from database
2. Verify USDC received in admin wallet
3. Calculate NGN amount (USDC × exchange rate - fees)
4. Create Paystack transfer recipient
5. Initiate Paystack transfer to user's account
6. Update transaction status
7. Record revenue (fees)

**Implementation Steps:**
- [ ] Create API route
- [ ] Verify USDC received (check admin wallet)
- [ ] Get exchange rate from settings
- [ ] Calculate fees (use tiered fee system)
- [ ] Calculate final NGN amount
- [ ] Create Paystack recipient
- [ ] Initiate Paystack transfer
- [ ] Update transaction status
- [ ] Record revenue

### 4.5 Background Job: Wallet Monitoring

**File:** `app/api/offramp/monitor-wallets/route.ts` (NEW)

**Endpoint:** `GET /api/offramp/monitor-wallets` (can be called by cron job)

**Logic:**
1. Get all pending off-ramp transactions
2. For each transaction, check wallet balance
3. If token detected, update status and trigger swap
4. If swap completed, check USDC and trigger payment
5. Handle retries for failed swaps

**Implementation Steps:**
- [ ] Create API route (or use Next.js API route as cron)
- [ ] Query pending transactions
- [ ] Check each wallet address
- [ ] Update statuses
- [ ] Trigger next steps automatically
- [ ] Add logging

**Alternative:** Use Vercel Cron Jobs or external cron service

---

## Phase 5: 1inch DEX Integration

### 5.1 1inch API Setup

**File:** `lib/1inch-swap.ts` (NEW)

**Key Functions:**
- `getSwapQuote()` - Get quote for token swap
- `executeSwap()` - Execute the swap
- `checkSwapStatus()` - Monitor swap status

**1inch API Endpoints:**
- Quote: `https://api.1inch.dev/swap/v6.0/8453/quote` (Base chain ID: 8453)
- Swap: `https://api.1inch.dev/swap/v6.0/8453/swap`

**Implementation Steps:**
- [ ] Get 1inch API key (register at 1inch.dev)
- [ ] Create swap utility library
- [ ] Implement quote function
- [ ] Implement swap execution
- [ ] Add error handling
- [ ] Test with testnet first

### 5.2 Token Support

**Supported Tokens:**
- Any ERC20 token on Base
- Native ETH
- USDC (Base)
- DAI, WETH, etc.

**Token Detection:**
- Check if native ETH (balance > 0, no token contract)
- Check ERC20 tokens (query contract balance)
- Get token metadata (symbol, decimals)

---

## Phase 6: Fee Calculation & Revenue Tracking

### 6.1 Off-Ramp Fee Calculation

**File:** `lib/offramp-fees.ts` (NEW)

- Reuse existing tiered fee system from on-ramp
- Calculate fees based on NGN amount (after USDC conversion)
- Same fee tiers as on-ramp (configurable in admin)

**Implementation Steps:**
- [ ] Create fee calculation utility
- [ ] Reuse `getFeeTiers()` from `lib/fee-calculation.ts`
- [ ] Calculate fees based on final NGN amount
- [ ] Record revenue in `offramp_revenue` table

### 6.2 Exchange Rate Calculation

- Use admin-configurable USDC to NGN rate
- Calculate: `ngnAmount = (usdcAmount × usdcToNgnRate) - fees`
- Store exchange rate in transaction record

---

## Phase 7: Admin Dashboard - Off-Ramp Tab

### 7.1 Create Off-Ramp Admin Page

**File:** `app/admin/offramp/page.tsx` (NEW)

**Features:**
- List all off-ramp transactions
- Filter by status, date, user
- View transaction details
- Manual actions: retry swap, refund, mark as paid
- Statistics: total volume, pending transactions, etc.

**Implementation Steps:**
- [ ] Create admin off-ramp page
- [ ] Add navigation link in admin sidebar
- [ ] Fetch transactions from API
- [ ] Display transaction list
- [ ] Add filters and search
- [ ] Add action buttons (retry, refund)
- [ ] Add statistics cards

### 7.2 Admin API Endpoints

**File:** `app/api/admin/offramp/route.ts` (NEW)

**Endpoints:**
- `GET /api/admin/offramp` - List all transactions
- `GET /api/admin/offramp/[id]` - Get transaction details
- `POST /api/admin/offramp/[id]/retry` - Retry swap
- `POST /api/admin/offramp/[id]/refund` - Refund to user
- `POST /api/admin/offramp/[id]/manual-pay` - Manually mark as paid

**Implementation Steps:**
- [ ] Create admin API routes
- [ ] Add admin authentication check
- [ ] Implement CRUD operations
- [ ] Add manual action endpoints

### 7.3 Admin Settings for Off-Ramp

**File:** `app/admin/settings/page.tsx` (UPDATE)

**Add Settings:**
- Off-ramp minimum amount (NGN)
- Off-ramp maximum amount (NGN)
- USDC to NGN exchange rate
- Off-ramp enabled/disabled toggle

**Implementation Steps:**
- [ ] Add off-ramp settings to settings page
- [ ] Update `lib/settings.ts` to include off-ramp settings
- [ ] Add API endpoints to update settings
- [ ] Add validation

---

## Phase 8: Error Handling & Retry Logic

### 8.1 Retry Mechanism

**Swap Retry Logic:**
1. First swap attempt fails → Retry once
2. Second swap attempt fails → Retry once more
3. Third swap attempt fails → Mark for manual review
4. Admin can retry or refund from dashboard

**Implementation:**
- Track swap attempts in `offramp_swap_attempts` table
- Update `swap_attempts` counter in transaction
- Auto-retry on failure (up to 2 retries)
- Notify admin after 3 failures

### 8.2 Refund Mechanism

**When to Refund:**
- Swap fails after all retries
- User requests refund
- Admin decides to refund

**How to Refund:**
- Send tokens back to user's original wallet (if known)
- Or send to user's email-linked wallet
- Record refund transaction hash

**Implementation Steps:**
- [ ] Create refund API endpoint
- [ ] Get user's wallet address (from user_wallets table)
- [ ] Send tokens back
- [ ] Update transaction status to "refunded"
- [ ] Record refund tx hash

---

## Phase 9: Testing & Validation

### 9.1 Test Scenarios

**Test Case 1: Successful Off-Ramp**
1. User generates payment → gets unique wallet
2. User sends ETH to wallet
3. System detects ETH → swaps to USDC
4. USDC received in admin wallet
5. Paystack sends Naira to user
6. Transaction marked as completed

**Test Case 2: Swap Retry**
1. First swap fails
2. System retries automatically
3. Second swap succeeds
4. Continue with payment

**Test Case 3: Manual Review**
1. All swap attempts fail
2. Transaction marked for manual review
3. Admin reviews in dashboard
4. Admin retries or refunds

**Test Case 4: Different Tokens**
- Test with ETH
- Test with USDC
- Test with DAI
- Test with other ERC20 tokens

### 9.2 Security Testing

- Verify HD wallet addresses are unique
- Verify admin wallet receives USDC before payment
- Verify fees are calculated correctly
- Verify user can't manipulate amounts
- Test with invalid account numbers

---

## Implementation Priority & Timeline

### 🔴 CRITICAL (Week 1)
1. **Database Schema** (Phase 1)
   - Create offramp_transactions table
   - Create revenue and swap attempts tables

2. **HD Wallet Setup** (Phase 2)
   - Generate master mnemonic
   - Create wallet utility library
   - Test address generation

### 🟡 HIGH PRIORITY (Week 2)
3. **Frontend Component** (Phase 3)
   - Create OffRampForm component
   - Add off-ramp page route
   - Integrate with backend

4. **Backend API - Basic** (Phase 4.1, 4.2)
   - Generate wallet address endpoint
   - Check token endpoint
   - Basic wallet monitoring

### 🟢 MEDIUM PRIORITY (Week 3)
5. **1inch Integration** (Phase 5)
   - Set up 1inch API
   - Implement swap functionality
   - Test with various tokens

6. **Payment Processing** (Phase 4.3, 4.4)
   - Swap to USDC endpoint
   - Paystack payment endpoint
   - Verify USDC before payment

### 🔵 LOWER PRIORITY (Week 4)
7. **Admin Dashboard** (Phase 7)
   - Off-ramp transactions page
   - Manual actions
   - Statistics

8. **Error Handling** (Phase 8)
   - Retry logic
   - Refund mechanism
   - Manual review workflow

---

## Files to Create/Modify

### New Files
1. `supabase/migrations/018_create_offramp_tables.sql` - Database schema
2. `lib/offramp-wallet.ts` - HD wallet utility
3. `lib/1inch-swap.ts` - 1inch DEX integration
4. `lib/offramp-fees.ts` - Fee calculation
5. `components/OffRampForm.tsx` - Frontend form component
6. `app/offramp/page.tsx` - Off-ramp page route
7. `app/api/offramp/generate-address/route.ts` - Generate wallet endpoint
8. `app/api/offramp/check-token/route.ts` - Check token endpoint
9. `app/api/offramp/swap-token/route.ts` - Swap token endpoint
10. `app/api/offramp/process-payment/route.ts` - Paystack payment endpoint
11. `app/api/offramp/monitor-wallets/route.ts` - Background monitoring
12. `app/api/admin/offramp/route.ts` - Admin API endpoints
13. `app/admin/offramp/page.tsx` - Admin dashboard page

### Modified Files
1. `lib/settings.ts` - Add off-ramp settings
2. `app/admin/settings/page.tsx` - Add off-ramp settings UI
3. `app/admin/layout.tsx` - Add off-ramp navigation link
4. `app/layout.tsx` or navigation component - Add off-ramp link for users
5. `.env.local` - Add HD wallet mnemonic and admin wallet

---

## Success Criteria

✅ **HD Wallet System**
- Unique wallet addresses generated for each transaction
- Addresses are cryptographically secure
- Can monitor all addresses from master seed

✅ **Token Detection**
- System detects any Base token sent to unique address
- Correctly identifies token type and amount
- Updates transaction status automatically

✅ **Swap Functionality**
- Successfully swaps any Base token to USDC
- USDC sent to admin wallet (not user wallet)
- Handles swap failures with retries

✅ **Payment Processing**
- Only pays user after USDC confirmed in admin wallet
- Calculates fees correctly
- Sends Naira to user's account via Paystack

✅ **Admin Dashboard**
- All off-ramp transactions visible
- Can manually retry, refund, or mark as paid
- Statistics and filtering work correctly

✅ **Error Handling**
- Retry mechanism works (2 auto-retries)
- Manual review available after failures
- Refund mechanism functional

---

## Next Steps - Off-Ramp Implementation

1. **Start with Phase 1**: Create database schema
2. **Then Phase 2**: Set up HD wallet system
3. **Then Phase 3**: Build frontend component
4. **Then Phase 4**: Implement backend APIs
5. **Then Phase 5**: Integrate 1inch DEX
6. **Finally**: Admin dashboard and error handling

**Ready to proceed with off-ramp implementation?** Switch to Executor mode to begin Phase 1.

---

## 🔄 WALLET EMPTYING SYSTEM - NEW REQUIREMENT

### Background and Motivation

**Current Issue:**
- Swapping via 0x API sometimes fails silently or doesn't complete
- System only swaps the first detected token, not all tokens in the wallet
- User wallets may retain tokens after processing, causing confusion

**New Requirement:**
- **Every user wallet address MUST be empty after off-ramp processing**
- System must detect and swap ALL tokens (not just one)
- If user doesn't have enough gas, fund the wallet first
- Swap all tokens to USDT/USDC
- Send all USDT/USDC to master wallet (receiver wallet)
- Recover ALL ETH gas fees back to master wallet
- Calculate equivalent amount in Naira (sum of all swapped tokens)
- Pay the end user that total amount

### Key Challenges and Analysis

1. **Token Detection**: Need to scan for ALL ERC20 tokens, not just common ones
2. **Gas Management**: Fund wallet if needed, then recover all ETH after swaps
3. **Multiple Swaps**: Handle multiple different tokens in one wallet
4. **Amount Calculation**: Sum all swapped tokens, convert to NGN
5. **Atomicity**: Ensure wallet is completely emptied or transaction fails

### High-level Task Breakdown

**Phase 1: Enhanced Token Detection**
- [ ] Scan wallet for ALL ERC20 tokens (not just common ones)
- [ ] Detect native ETH balance
- [ ] Return list of all tokens with balances > 0
- [ ] Update `check-token` endpoint to return all tokens

**Phase 2: Gas Funding & Recovery**
- [ ] Check if wallet has enough ETH for gas
- [ ] If not, fund from master wallet
- [ ] After all swaps, recover ALL remaining ETH to master wallet
- [ ] Verify wallet is completely empty

**Phase 3: Multi-Token Swap System**
- [ ] Create endpoint to swap all tokens sequentially
- [ ] Swap each detected token to USDC/USDT
- [ ] Handle multiple swaps in one transaction flow
- [ ] Track all swap transactions

**Phase 4: Complete Wallet Emptying**
- [ ] Transfer all USDC/USDT to master wallet (receiver wallet)
- [ ] Recover all ETH to master wallet
- [ ] Verify wallet is completely empty (ETH = 0, all tokens = 0)
- [ ] Update transaction status

**Phase 5: Amount Calculation & Payment**
- [ ] Sum all swapped amounts (in USDC equivalent)
- [ ] Calculate total NGN amount using exchange rate
- [ ] Deduct fees
- [ ] Pay user via Paystack

### Implementation Details

**New/Modified Endpoints:**

1. **`/api/offramp/check-token` (MODIFY)**
   - Scan for ALL tokens (not just first one)
   - Return array of all tokens found with balances
   - Support both single token (backward compatible) and multi-token detection

2. **`/api/offramp/empty-wallet` (NEW)**
   - Main endpoint for complete wallet emptying
   - Detects all tokens
   - Funds gas if needed
   - Swaps all tokens to USDC
   - Transfers USDC to master wallet
   - Recovers ETH to master wallet
   - Calculates and records total amount
   - Returns summary of all actions

3. **`/api/offramp/swap-token` (MODIFY)**
   - Keep existing functionality for single token swaps
   - Add support for batch swapping (optional)

**Database Changes:**
- Add field to track all tokens found: `all_tokens_detected JSONB`
- Add field for total USDC amount: `total_usdc_amount`
- Add field for wallet emptied status: `wallet_emptied BOOLEAN`

### Files to Create/Modify

**New Files:**
1. `lib/wallet-scanner.ts` - Utility to scan wallet for all ERC20 tokens
2. `lib/wallet-emptier.ts` - Core logic for emptying wallets

**Modified Files:**
1. `app/api/offramp/check-token/route.ts` - Return all tokens
2. `app/api/offramp/swap-token/route.ts` - Enhance to handle multiple tokens
3. `app/api/offramp/monitor-wallets/route.ts` - Use new empty-wallet endpoint
4. `lib/offramp-wallet.ts` - Add gas funding/recovery utilities

### Success Criteria

✅ **Complete Wallet Emptying**
- All tokens detected and swapped
- All USDC transferred to master wallet
- All ETH recovered to master wallet
- Wallet balance verified as zero

✅ **Gas Management**
- Wallet funded if insufficient gas
- All gas recovered after swaps
- No ETH left in user wallet

✅ **Amount Calculation**
- Total amount calculated correctly
- All tokens converted to USDC equivalent
- NGN amount calculated with fees deducted

✅ **Payment Processing**
- User paid correct total amount
- Transaction marked as completed
- Wallet verified as empty

---

**Status**: 🟡 IN PROGRESS - Executor implementing wallet emptying system
