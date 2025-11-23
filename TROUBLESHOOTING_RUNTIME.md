# Troubleshooting Runtime Errors

## Error: Failed to load chunk server/chunks/ssr

This error is typically caused by:
1. Stale build cache
2. Dev server not restarted after changes
3. Module resolution issues

## Solutions

### Solution 1: Clear Cache and Restart (Most Common)

```bash
# Stop the dev server (Ctrl+C or Cmd+C)

# Clear Next.js cache
rm -rf .next

# Clear node_modules cache (if needed)
rm -rf node_modules/.cache

# Restart dev server
npm run dev
```

### Solution 2: Full Clean Rebuild

```bash
# Stop dev server
# Remove all caches
rm -rf .next
rm -rf node_modules/.cache

# Rebuild
npm run build

# Start dev server
npm run dev
```

### Solution 3: Check for Import Issues

Make sure all imports are correct:
- Use `@/` alias for imports (configured in tsconfig.json)
- Ensure all components have proper exports
- Check for circular dependencies

### Solution 4: Turbopack-Specific Issues

If using Turbopack (Next.js 16 default):
- Try disabling Turbopack temporarily:
  ```bash
  npm run dev -- --no-turbo
  ```
- Or update Next.js if there's a known issue

### Solution 5: Port Conflicts

If port 3000 is in use:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- -p 3001
```

## Prevention

1. Always restart dev server after:
   - Adding new dependencies
   - Changing tsconfig.json
   - Modifying import paths
   - Major refactoring

2. Clear cache when:
   - Build errors persist
   - Runtime errors appear
   - Strange behavior occurs

3. Keep Next.js updated:
   ```bash
   npm update next
   ```

