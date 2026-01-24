# Local Webhook Setup with ngrok

This guide will help you set up ngrok to expose your localhost webhook endpoint for Flutterwave testing during development.

---

## 📋 Prerequisites

- ngrok installed ([Download ngrok](https://ngrok.com/download))
- Flutterwave account with API credentials
- Node.js and npm installed

---

## 🚀 Step 1: Install ngrok

### macOS (using Homebrew):
```bash
brew install ngrok/ngrok/ngrok
```

### Or download directly:
1. Go to [https://ngrok.com/download](https://ngrok.com/download)
2. Download for your OS
3. Extract and add to your PATH, or use the full path

### Sign up for free account:
1. Go to [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)
2. Sign up for a free account
3. Get your authtoken from the dashboard

### Authenticate ngrok:
```bash
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```

---

## 🔧 Step 2: Start Your Server on Port 80

**Important:** Running on port 80 requires admin/sudo privileges on macOS/Linux.

### Option A: Run with sudo (macOS/Linux)
```bash
sudo npm run dev:80
```

### Option B: Run without sudo (if you have permission)
```bash
npm run dev:80
```

### Option C: Use port 3000 instead (no sudo needed)
If you prefer not to use sudo, you can use port 3000:
```bash
npm run dev
# Then use: ngrok http 3000
```

**Note:** The server will be accessible at:
- `http://localhost:80` (if using port 80)
- `http://localhost:3000` (if using port 3000)

---

## 🌐 Step 3: Start ngrok Tunnel

Open a **new terminal window** (keep your dev server running) and run:

### If using port 80:
```bash
ngrok http 80
```

### If using port 3000:
```bash
ngrok http 3000
```

### Expected Output:
```
ngrok                                                                              
                                                                                    
Session Status                online                                               
Account                       Your Name (Plan: Free)                               
Version                       3.x.x                                                
Region                        United States (us)                                    
Latency                      45ms                                                  
Web Interface                http://127.0.0.1:4040                                 
Forwarding                    https://abc123xyz.ngrok-free.app -> http://localhost:80
                                                                                    
Connections                   ttl     opn     rt1     rt5     p50     p90           
                              0       0       0.00    0.00    0.00    0.00          
```

**Important:** Copy the `Forwarding` URL (e.g., `https://abc123xyz.ngrok-free.app`)

---

## 🔗 Step 4: Configure Flutterwave Webhook

1. **Go to Flutterwave Dashboard**
   - Navigate to [https://dashboard.flutterwave.com](https://dashboard.flutterwave.com)
   - Go to **Settings → Webhooks**

2. **Add/Update Webhook**
   - Click **"Add Webhook"** or edit existing webhook
   - Enter your webhook URL:
     ```
     https://your-ngrok-url.ngrok-free.app/api/flutterwave/webhook
     ```
     Replace `your-ngrok-url.ngrok-free.app` with your actual ngrok URL from Step 3

3. **Subscribe to Events**
   Select these events:
   - ✅ `charge.success`
   - ✅ `charge.failed`
   - ✅ `virtualaccountpayment`
   - ✅ `transfer.completed`
   - ✅ `transfer.failed`
   - ✅ `refund.completed`

4. **Set Webhook Secret Hash**
   - Generate a secret hash (or use existing one)
   - Save it - you'll need it for Step 5

5. **Save the Webhook**

---

## 🔐 Step 5: Add Webhook Secret to Environment Variables

Add to your `.env.local` file:

```bash
FLUTTERWAVE_WEBHOOK_SECRET_HASH=your_secret_hash_from_flutterwave_dashboard
```

**Example:**
```bash
FLUTTERWAVE_WEBHOOK_SECRET_HASH=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Important:** Restart your dev server after adding this:
```bash
# Stop server (Ctrl+C)
# Start again
sudo npm run dev:80  # or npm run dev:80
```

---

## ✅ Step 6: Test Your Webhook

### Test 1: Check ngrok Web Interface
1. Open your browser and go to: `http://127.0.0.1:4040`
2. This shows ngrok's request inspector
3. You'll see all requests coming through the tunnel

### Test 2: Make a Test Payment
1. Make a small test payment through your application
2. Check ngrok web interface (`http://127.0.0.1:4040`) for incoming webhook requests
3. Check your terminal logs for `[Flutterwave Webhook]` messages

### Test 3: Check Flutterwave Dashboard
1. Go to Flutterwave Dashboard → Settings → Webhooks
2. Click on your webhook
3. Check **"Webhook Logs"** or **"Event History"**
4. You should see successful webhook deliveries (200 OK)

---

## 🔄 Step 7: Keep ngrok Running

**Important Notes:**

1. **ngrok URL changes on restart:** Each time you restart ngrok, you get a new URL
   - Free plan: URL changes every restart
   - Paid plan: Can use custom domains

2. **Update Flutterwave webhook URL** if ngrok restarts:
   - If you restart ngrok, update the webhook URL in Flutterwave dashboard

3. **Keep both terminals open:**
   - Terminal 1: Dev server (`npm run dev:80`)
   - Terminal 2: ngrok tunnel (`ngrok http 80`)

---

## 🛠️ Troubleshooting

### ngrok URL Not Working

**Problem:** Flutterwave can't reach your webhook

**Solutions:**
1. Make sure ngrok is running (`ngrok http 80`)
2. Check ngrok web interface (`http://127.0.0.1:4040`) for errors
3. Verify your dev server is running on port 80
4. Test the webhook URL directly:
   ```bash
   curl https://your-ngrok-url.ngrok-free.app/api/flutterwave/webhook
   ```

### "Invalid Signature" Errors

**Problem:** Webhook signature verification fails

**Solutions:**
1. Ensure `FLUTTERWAVE_WEBHOOK_SECRET_HASH` matches Flutterwave dashboard
2. Restart dev server after adding environment variable
3. Check for typos or extra spaces in the secret hash

### Port 80 Permission Denied

**Problem:** Can't bind to port 80

**Solutions:**
1. Use `sudo npm run dev:80` (macOS/Linux)
2. Or use port 3000 instead:
   ```bash
   npm run dev
   ngrok http 3000
   ```

### ngrok Free Plan Limitations

**Problem:** ngrok URL changes frequently

**Solutions:**
1. Use ngrok's static domain (paid feature)
2. Or update Flutterwave webhook URL when ngrok restarts
3. Consider using a paid ngrok plan for stable URLs

---

## 📝 Quick Reference Commands

```bash
# Terminal 1: Start dev server on port 80
sudo npm run dev:80

# Terminal 2: Start ngrok tunnel
ngrok http 80

# Terminal 3: Check ngrok requests (optional)
# Open browser: http://127.0.0.1:4040
```

---

## 🎯 Your Webhook URL Format

Once ngrok is running, your webhook URL will be:
```
https://[random-id].ngrok-free.app/api/flutterwave/webhook
```

**Example:**
```
https://abc123xyz.ngrok-free.app/api/flutterwave/webhook
```

---

## 💡 Pro Tips

1. **Use ngrok web interface:** Visit `http://127.0.0.1:4040` to see all requests in real-time
2. **Test webhook locally first:** Use curl or Postman to test your webhook endpoint
3. **Check logs:** Monitor both ngrok web interface and your dev server logs
4. **Keep ngrok running:** Don't close the ngrok terminal while testing
5. **Update webhook URL:** Remember to update Flutterwave webhook URL if ngrok restarts

---

## ✅ Checklist

- [ ] ngrok installed and authenticated
- [ ] Dev server running on port 80 (or 3000)
- [ ] ngrok tunnel active (`ngrok http 80`)
- [ ] Webhook URL copied from ngrok output
- [ ] Flutterwave webhook configured with ngrok URL
- [ ] `FLUTTERWAVE_WEBHOOK_SECRET_HASH` added to `.env.local`
- [ ] Dev server restarted after adding environment variable
- [ ] Test payment made and webhook received

---

**Need Help?** Check ngrok web interface at `http://127.0.0.1:4040` to see incoming requests and debug issues.
