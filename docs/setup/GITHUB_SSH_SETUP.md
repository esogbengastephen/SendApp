# GitHub SSH Setup Guide

This guide will help you set up SSH authentication for GitHub.

---

## Step 1: Check Existing SSH Keys

You already have an SSH key at: `~/.ssh/id_ed25519.pub`

To view your public key:
```bash
cat ~/.ssh/id_ed25519.pub
```

---

## Step 2: Add SSH Key to GitHub

1. **Copy your SSH public key:**
   ```bash
   cat ~/.ssh/id_ed25519.pub | pbcopy
   ```
   (This copies it to your clipboard on macOS)

2. **Go to GitHub Settings:**
   - Visit: https://github.com/settings/keys
   - Or: GitHub → Your Profile → Settings → SSH and GPG keys

3. **Add New SSH Key:**
   - Click **"New SSH key"** button
   - **Title:** Give it a name (e.g., "MacBook Pro")
   - **Key:** Paste your public key (from clipboard)
   - **Key type:** Authentication Key
   - Click **"Add SSH key"**

---

## Step 3: Configure SSH for GitHub (if port 22 is blocked)

If port 22 is blocked by your network/firewall, use GitHub's HTTPS port (443) instead.

### Create/Update SSH Config:

```bash
# Create or edit SSH config
nano ~/.ssh/config
```

Add this configuration:

```
Host github.com
    Hostname ssh.github.com
    Port 443
    User git
    IdentityFile ~/.ssh/id_ed25519
```

Save and exit (Ctrl+X, then Y, then Enter for nano).

### Set correct permissions:

```bash
chmod 600 ~/.ssh/config
chmod 644 ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/id_ed25519
```

---

## Step 4: Test SSH Connection

Test the connection:

```bash
ssh -T git@github.com
```

**Expected output:**
```
Hi esogbengastephen! You've successfully authenticated, but GitHub does not provide shell access.
```

If you see this, SSH is working! ✅

---

## Step 5: Update Git Remote (if needed)

If your remote is using HTTPS, switch to SSH:

```bash
cd "/Users/user/Documents/Softwaer development /Send Xino"
git remote -v  # Check current remote

# If it shows HTTPS, switch to SSH:
git remote set-url origin git@github.com:esogbengastephen/SendApp.git
```

---

## Troubleshooting

### "Permission denied (publickey)"

**Solution:**
- Make sure your SSH key is added to GitHub
- Check that the key file permissions are correct:
  ```bash
  chmod 600 ~/.ssh/id_ed25519
  ```

### "Connection timed out on port 22"

**Solution:**
- Use the SSH config above to use port 443 instead
- Or check if your firewall/network is blocking port 22

### "Host key verification failed"

**Solution:**
```bash
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts
```

### Generate New SSH Key (if needed)

If you need to generate a new SSH key:

```bash
# Generate new Ed25519 key (recommended)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Or if Ed25519 not supported, use RSA:
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

Follow the prompts (press Enter to accept default file location and optionally set a passphrase).

---

## Quick Commands Reference

```bash
# View your public key
cat ~/.ssh/id_ed25519.pub

# Copy public key to clipboard (macOS)
cat ~/.ssh/id_ed25519.pub | pbcopy

# Test SSH connection
ssh -T git@github.com

# Check git remote
git remote -v

# Switch to SSH remote
git remote set-url origin git@github.com:esogbengastephen/SendApp.git

# Push to GitHub
git push origin main
```

---

## After Setup

Once SSH is working:

1. **Test the connection:**
   ```bash
   ssh -T git@github.com
   ```

2. **Push your changes:**
   ```bash
   cd "/Users/user/Documents/Softwaer development /Send Xino"
   git push origin main
   ```

---

## Need Help?

- [GitHub SSH Documentation](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Troubleshooting SSH](https://docs.github.com/en/authentication/troubleshooting-ssh)
