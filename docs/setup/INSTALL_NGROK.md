# Installing ngrok on macOS

Since `brew` is not installed, here are two ways to install ngrok:

---

## Option 1: Install Homebrew First (Recommended)

Homebrew is a package manager that makes installing tools easier.

### Step 1: Install Homebrew

Run this command in your terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Note:** This will ask for your password (for sudo access). The installation takes a few minutes.

### Step 2: Add Homebrew to PATH

After installation, you'll see instructions. Usually you need to run:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Step 3: Install ngrok

```bash
brew install ngrok/ngrok/ngrok
```

---

## Option 2: Download ngrok Directly (Faster)

If you don't want to install Homebrew, download ngrok directly:

### Step 1: Download ngrok

1. Go to: https://ngrok.com/download
2. Select **macOS** (or **macOS ARM64** if you have Apple Silicon)
3. Download the ZIP file

### Step 2: Extract and Install

```bash
# Navigate to Downloads
cd ~/Downloads

# Extract the ZIP file (replace with actual filename)
unzip ngrok-v3-stable-darwin-amd64.zip
# OR if ARM64:
# unzip ngrok-v3-stable-darwin-arm64.zip

# Move to a location in your PATH
sudo mv ngrok /usr/local/bin/

# Make it executable
sudo chmod +x /usr/local/bin/ngrok
```

### Step 3: Verify Installation

```bash
ngrok version
```

You should see the version number.

---

## Step 4: Sign Up and Authenticate ngrok

### Create Free Account

1. Go to: https://dashboard.ngrok.com/signup
2. Sign up for a free account (email signup)

### Get Your Authtoken

1. After signing up, go to: https://dashboard.ngrok.com/get-started/your-authtoken
2. Copy your authtoken (looks like: `2abc123def456ghi789jkl012mno345pqr678stu`)

### Authenticate ngrok

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

Replace `YOUR_AUTHTOKEN_HERE` with the actual token from the dashboard.

---

## Step 5: Test ngrok

```bash
# Start a test tunnel (this will start a simple HTTP server on port 8080)
ngrok http 8080
```

You should see output like:
```
ngrok                                                                              
                                                                                    
Session Status                online                                               
Account                       Your Name (Plan: Free)                               
Version                       3.x.x                                                
Region                        United States (us)                                    
Latency                      45ms                                                  
Web Interface                http://127.0.0.1:4040                                 
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:8080
```

Press `Ctrl+C` to stop.

---

## ✅ Verification Checklist

- [ ] ngrok installed (`ngrok version` works)
- [ ] ngrok account created
- [ ] Authtoken added (`ngrok config add-authtoken ...`)
- [ ] Test tunnel works (`ngrok http 8080`)

---

## Next Steps

Once ngrok is installed and authenticated, you can proceed with the webhook setup:

1. Start your dev server: `sudo npm run dev:80`
2. Start ngrok: `ngrok http 80`
3. Copy the ngrok URL and configure Flutterwave webhook

See `docs/setup/LOCAL_WEBHOOK_SETUP_NGROK.md` for complete webhook setup instructions.

---

## Troubleshooting

### "ngrok: command not found"

**Solution:** Make sure ngrok is in your PATH:
```bash
# Check if ngrok exists
which ngrok

# If not found, add it to PATH or use full path
/usr/local/bin/ngrok version
```

### "ngrok: permission denied"

**Solution:** Make ngrok executable:
```bash
sudo chmod +x /usr/local/bin/ngrok
```

### "ngrok: no authtoken"

**Solution:** Add your authtoken:
```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```
