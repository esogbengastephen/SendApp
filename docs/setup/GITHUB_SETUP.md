# GitHub Setup Guide

## Setting Up GitHub Authentication

To push to GitHub, you need to authenticate. Here are the steps:

### Step 1: Create a Personal Access Token

1. Go to GitHub: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `SendApp Push Token`
4. Select expiration (or "No expiration" for convenience)
5. **Select scope**: Check `repo` (this gives full repository access)
6. Click **"Generate token"**
7. **Copy the token immediately** (you won't see it again!)

### Step 2: Use the Token to Push

Once you have your token, run this command (replace `YOUR_TOKEN` with your actual token):

```bash
cd "/Users/user/Documents/Softwaer development /Send Xino"
git push https://YOUR_TOKEN@github.com/esogbengastephen/SendApp.git main
```

### Alternative: Store Token in Keychain

To avoid entering the token every time, you can store it:

```bash
# This will prompt for username and password
# Username: esogbengastephen
# Password: YOUR_PERSONAL_ACCESS_TOKEN (not your GitHub password!)
git push origin main
```

The macOS keychain will store your credentials for future use.

### Step 3: Verify Push

After pushing, check your repository:
https://github.com/esogbengastephen/SendApp

You should see your latest commit with the message:
"feat: Implement email-based virtual accounts and dummy email for Paystack"

---

## Current Git Configuration

- **User**: esogbengastephen
- **Email**: esogbengastephen@users.noreply.github.com
- **Remote**: https://github.com/esogbengastephen/SendApp.git
- **Branch**: main

---

## Troubleshooting

### If push still fails:
1. Make sure you copied the entire token (it's long!)
2. Make sure the `repo` scope is selected
3. Try using the token directly in the URL as shown above

### To check if credentials are stored:
```bash
git credential-osxkeychain get
```

### To remove stored credentials:
```bash
git credential-osxkeychain erase
# Then enter:
# protocol=https
# host=github.com
# (Press Enter twice)
```

