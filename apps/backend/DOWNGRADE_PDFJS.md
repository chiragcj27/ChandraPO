# Downgrading pdfjs-dist to v4.x

The `toHex` error is caused by compatibility issues between `pdfjs-dist` v5.x and the `canvas` package. 

## Solution: Use pdfjs-dist v4.x

I've updated `package.json` to use `pdfjs-dist` v4.0.379 which is more compatible with Node.js 20 and the `canvas` package.

## Next Steps

1. **Remove node_modules and reinstall:**
   ```bash
   cd apps/backend
   rm -rf node_modules
   npm install
   ```

2. **Restart your server:**
   ```bash
   npm run dev
   ```

## Why v4.x?

- Better compatibility with Node.js 20
- Works with `canvas` package (not requiring `@napi-rs/canvas`)
- More stable for server-side rendering
- Still supports all the features we need

## If Issues Persist

If you still get errors, you can try installing `@napi-rs/canvas`:
```bash
npm install @napi-rs/canvas
```

But v4.x should work fine with the regular `canvas` package.
