# Virtual Account Creation on Signup - Implementation Summary

## 🎯 What Was Implemented

When a user creates an account with their email, the system now **automatically**:

1. ✅ Creates a Paystack customer with name **"Send App"** (first_name: "Send", last_name: "App")
2. ✅ Creates a **Wema Bank** dedicated virtual account
3. ✅ Stores the account details in the `users` table
4. ✅ Each user gets a **unique account number** immediately after signup

## 📁 Files Created/Modified

### New Files:
- `app/api/paystack/create-virtual-account-signup/route.ts` - Dedicated API for signup virtual account creation
- `supabase/migrations/008_add_user_paystack_fields.sql` - Database migration for new columns
- `scripts/run-migration-008-simple.ts` - Migration script
- `VIRTUAL_ACCOUNT_ON_SIGNUP.md` - This documentation

### Modified Files:
- `app/api/auth/signup/route.ts` - Now calls virtual account creation after successful signup

## 🔧 Database Changes Required

You need to run this SQL in your **Supabase SQL Editor**:

Go to: https://ksdzzqdafodlstfkqzuv.supabase.co/project/ksdzzqdafodlstfkqzuv/sql

```sql
-- Add paystack_customer_code to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  paystack_customer_code TEXT;

-- Add virtual_account_assigned_at to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS 
  virtual_account_assigned_at TIMESTAMP WITH TIME ZONE;

-- Add index for fast lookups by customer code
CREATE INDEX IF NOT EXISTS idx_users_paystack_customer 
  ON users(paystack_customer_code);

-- Add index for virtual account number lookups
CREATE INDEX IF NOT EXISTS idx_users_virtual_account 
  ON users(default_virtual_account_number);
```

## 🔄 Flow Diagram

```
User Signs Up
    ↓
[Verify Confirmation Code]
    ↓
[Create User Account]
    ↓
[Send Referral Code Email] ← (existing)
    ↓
[Create Paystack Customer] ← NEW!
    ↓
[Create Wema Bank Virtual Account] ← NEW!
    ↓
[Store Account in Database] ← NEW!
    ↓
User Can Immediately Make Payments!
```

## 🎨 User Experience

### Before:
- User signs up
- User enters wallet address + amount
- System generates virtual account **on first payment**
- User waits...

### After:
- User signs up
- **Virtual account created immediately**
- User can make payments right away!
- No waiting for account generation

## 📝 API Endpoint Details

### `/api/paystack/create-virtual-account-signup`

**Request:**
```json
{
  "userId": "user-uuid",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accountNumber": "9876543210",
    "bankName": "Wema Bank",
    "accountName": "Send App",
    "customerCode": "CUS_xxxxx"
  }
}
```

## 🔍 What Happens During Signup

1. **User submits confirmation code** → verified ✅
2. **Account created in database** → `users` table
3. **Referral email sent** → with unique referral code
4. **Paystack customer created**:
   - Email: user's email
   - First name: "Send"
   - Last name: "App"
   - Result: Customer shows as **"Send App"** in Paystack
5. **Virtual account created**:
   - Bank: Wema Bank (preferred_bank: "wema-bank")
   - Customer: from step 4
   - Result: Unique account number assigned
6. **Database updated**:
   - `paystack_customer_code` → saved
   - `default_virtual_account_number` → saved
   - `default_virtual_account_bank` → "Wema Bank"
   - `virtual_account_assigned_at` → timestamp

## 🎯 Benefits

1. **Instant Availability**: Users can pay immediately after signup
2. **Unique Accounts**: Each user has their own bank account number
3. **Better UX**: No waiting for account generation on first payment
4. **Automatic Detection**: Payments automatically linked to user via virtual account
5. **Branded Experience**: All accounts show as "Send App" in user's bank app

## 🧪 Testing

To test this implementation:

1. **Run the database migration** (SQL above)
2. **Create a new test account**:
   ```bash
   # Go to your app's signup page
   # Use a new email address
   # Complete verification
   ```
3. **Check the logs**:
   ```
   [Signup] Creating virtual account for test@example.com
   [Signup VA] Creating Paystack customer for test@example.com
   [Signup VA] ✅ Customer created: CUS_xxxxx
   [Signup VA] Creating Wema Bank virtual account for CUS_xxxxx
   [Signup VA] ✅ Virtual account: 1234567890 (Wema Bank)
   [Signup] ✅ Virtual account created: 1234567890 (Wema Bank)
   ```
4. **Verify in Supabase**:
   ```sql
   SELECT 
     email, 
     paystack_customer_code, 
     default_virtual_account_number,
     default_virtual_account_bank,
     virtual_account_assigned_at
   FROM users 
   WHERE email = 'test@example.com';
   ```

## 🚨 Important Notes

1. **Bank Selection**: Uses Wema Bank by default (`preferred_bank: "wema-bank"`)
2. **Account Name**: Always shows as "Send App" (from customer first_name + last_name)
3. **Error Handling**: If virtual account creation fails, signup still succeeds (logged as warning)
4. **Existing Users**: Only new signups get automatic virtual accounts
5. **Webhook**: The existing webhook in `/api/paystack/webhook` will automatically detect payments to these accounts

## 🔄 Migration Path for Existing Users

Existing users who signed up before this feature can get virtual accounts by:

1. Making their first payment (old flow still works)
2. Or, you can run a bulk migration script to create accounts for all existing users

## 📊 Monitoring

Check these logs to verify it's working:

```bash
# In your application logs
grep "Signup VA" logs.txt

# Should see:
# [Signup VA] Creating virtual account for user...
# [Signup VA] ✅ Customer created: CUS_...
# [Signup VA] ✅ Virtual account: ... (Wema Bank)
# [Signup VA] ✅ SUCCESS - Account ... assigned to ...
```

## ✅ Completion Checklist

- [x] Create new API endpoint for signup virtual account creation
- [x] Update signup route to call the new endpoint
- [x] Create database migration for new columns
- [x] Update API to use "Send App" as customer name
- [x] Ensure Wema Bank is selected as preferred bank
- [ ] **Run database migration in Supabase** (USER ACTION REQUIRED)
- [ ] Test with a new signup
- [ ] Verify in Paystack dashboard
- [ ] Monitor logs for any errors

---

## 🚀 Ready to Deploy!

Once you run the database migration SQL, the system is ready to automatically create virtual accounts for all new signups!

