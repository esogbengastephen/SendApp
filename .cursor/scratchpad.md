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
