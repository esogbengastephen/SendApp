# Fix 404 Error - Buy Airtime Page

## Problem
Getting a 404 error when trying to access `/buy-airtime` or other routes.

## Solutions

### 1. **Check Server is Running**
The 404 error usually means the Next.js server isn't running or isn't accessible.

**Start the server:**
```bash
cd "/Users/user/Documents/Softwaer development /Send Xino"
npm run dev
```

**Expected output:**
```
▲ Next.js 16.x.x
- Local:        http://localhost:3000
- Ready in X seconds
```

### 2. **Access the Correct URL**
Make sure you're accessing:
- ✅ **Correct:** http://localhost:3000/buy-airtime
- ❌ **Wrong:** http://127.0.0.1:3001/buy-airtime (if server is on 3000)
- ❌ **Wrong:** http://localhost:3001/buy-airtime (if server is on 3000)

### 3. **Check for Compilation Errors**
If the server is running but you still get 404, check the terminal for errors:

**Common issues:**
- Syntax errors in page files
- Missing dependencies
- TypeScript errors

**Fix compilation errors:**
```bash
# Check for TypeScript errors
npm run lint

# Clear Next.js cache
rm -rf .next
npm run dev
```

### 4. **Verify Route Exists**
The route should exist at: `app/buy-airtime/page.tsx`

**Check if file exists:**
```bash
ls -la "app/buy-airtime/page.tsx"
```

### 5. **Clear Browser Cache**
Sometimes browser cache can cause 404 errors:

- **Chrome/Edge:** Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Or:** Open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

### 6. **Check Authentication**
The `/buy-airtime` page redirects to `/auth` if you're not logged in. Make sure:
- You're logged in
- Session is valid
- Try accessing: http://localhost:3000/auth first

### 7. **Port Conflicts**
If port 3000 is in use:

**Check what's using port 3000:**
```bash
lsof -i :3000
```

**Kill the process:**
```bash
kill -9 $(lsof -ti:3000)
```

**Or use a different port:**
```bash
PORT=3001 npm run dev
# Then access: http://localhost:3001/buy-airtime
```

## Quick Fix Checklist

- [ ] Server is running (`npm run dev`)
- [ ] No compilation errors in terminal
- [ ] Accessing correct URL: http://localhost:3000/buy-airtime
- [ ] Browser cache cleared
- [ ] User is logged in
- [ ] Port 3000 is available

## Still Getting 404?

1. **Check server logs** - Look for errors in the terminal where `npm run dev` is running
2. **Try a different route** - Test http://localhost:3000/ to see if the homepage loads
3. **Restart the server** - Stop (Ctrl+C) and start again
4. **Check Next.js version** - Make sure you're using Next.js 16.x

## Test Routes

Once server is running, test these URLs:
- Homepage: http://localhost:3000/
- Auth: http://localhost:3000/auth
- Buy Airtime: http://localhost:3000/buy-airtime
- Buy Data: http://localhost:3000/buy-data
- Buy Electricity: http://localhost:3000/buy-electricity
