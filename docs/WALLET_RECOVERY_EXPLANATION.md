# Wallet Recovery Explanation

## Why Can't We Recover Tokens from Wallets Created with the Same Mnemonic?

### The Problem

You're asking: **"Why can't we recover tokens from a wallet address that was created from the same OFFRAMP_MASTER_MNEMONIC?"**

The answer is: **The mnemonic is NOT the same anymore.**

### What Happened

1. **Yesterday**: 
   - Mnemonic A was in `.env.local`
   - Wallet `0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2` was generated using Mnemonic A + `test@example.com`
   - System successfully signed transactions from this wallet

2. **Today**:
   - Mnemonic B is in `.env.local` (different from Mnemonic A)
   - When we try to generate wallet for `test@example.com` using Mnemonic B, we get `0xed77e10dd5158ED24c8857E1e7894FBe30D8f88c` (different wallet!)
   - We cannot derive the private key for `0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2` using Mnemonic B

### How HD Wallets Work

HD (Hierarchical Deterministic) wallets generate addresses deterministically:

```
Mnemonic → Seed → Root Node → Derivation Path → Wallet Address
```

**Same mnemonic + Same derivation path = Same wallet address**

**Different mnemonic + Same derivation path = Different wallet address**

### Why We Can't Recover

To recover tokens from a wallet, we need:
1. **The private key** for that wallet, OR
2. **The mnemonic that generated it** + the derivation path

Since the mnemonic changed, we cannot derive the private key anymore.

### Solution

To recover tokens from `0x20717a8732D3341201Fa33A06bBE5ed91DBfdEB2`, you need:

1. **Find yesterday's mnemonic** (Mnemonic A) and restore it to `.env.local`
   - Then we can generate the wallet again and recover tokens

2. **OR provide the private key** directly for that wallet
   - Then we can use the `recover-tokens` endpoint with the private key

### Prevention

1. **Backup your mnemonic** securely
2. **Never change the mnemonic** once wallets are in use
3. **Version control**: Track mnemonic changes (but don't commit the actual mnemonic!)
4. **Documentation**: Record when and why mnemonics change

