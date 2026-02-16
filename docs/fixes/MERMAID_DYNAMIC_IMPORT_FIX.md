# Mermaid Dynamic Import Error Fix

## Problem

When clicking "Mermaid Diagram Fix Mermaid" button, you encounter:
```
[Error] Failed to load resource: the server responded with a status of 404 (Not Found)
(sequenceDiagram-SKLFT4DO-HR64VSRU.js, line 0)
[Error] ❌ Mermaid parse error details: TypeError: Importing a module script failed.
```

## Root Cause

Mermaid 10+ versions use dynamic imports to load diagram type modules (sequenceDiagram, flowchart, etc.) on demand. Vite's dependency pre-bundling can conflict with these dynamic imports, causing 404 errors for modules like `sequenceDiagram-SKLFT4DO-HR64VSRU.js`.

## Solution Applied

### 1. Updated `vite.config.ts`

Changed from trying to pre-bundle Mermaid to excluding it, allowing native dynamic imports:

```typescript
export default defineConfig(async () => ({
  plugins: [react()],

  // Optimize dependencies to fix Mermaid dynamic imports
  optimizeDeps: {
    // Exclude mermaid from optimization to allow native dynamic imports
    exclude: ['mermaid'],
  },

  // ... rest of config
}));
```

### 2. Cleared Vite Cache

```bash
rm -rf node_modules/.vite
```

## Steps to Apply Fix

### Step 1: Stop the Development Server
Press `Ctrl+C` or `Cmd+C` to stop the current `npm run dev` or `npm run tauri dev` process.

### Step 2: Clear Vite Cache (Already Done)
```bash
rm -rf node_modules/.vite
```

### Step 3: Restart Development Server
```bash
npm run tauri dev
# or
npm run dev
```

### Step 4: Test Mermaid Diagrams
1. Open the application
2. Navigate to a chat with Mermaid diagrams
3. Click "Fix Mermaid" button
4. Verify diagrams render correctly

## Why This Works

### Before (Failed)
```typescript
optimizeDeps: {
  include: ['mermaid', 'mermaid/dist/mermaidAPI'],
}
```
This tried to pre-bundle Mermaid, but Vite's bundler couldn't handle Mermaid's internal dynamic imports correctly.

### After (Success)
```typescript
optimizeDeps: {
  exclude: ['mermaid'],
}
```
This tells Vite to skip pre-bundling Mermaid, allowing it to use its native dynamic import mechanism for diagram type modules.

## Technical Details

### Mermaid Dynamic Import Structure
Mermaid 11.x uses code splitting to load diagram types:
- Base: `mermaid/dist/mermaid.core.js`
- Sequence: `mermaid/dist/diagrams/sequence/sequenceDiagram-*.js`
- Flowchart: `mermaid/dist/diagrams/flowchart/flowchart-*.js`
- etc.

### Vite's Pre-Bundling
Vite pre-bundles dependencies for faster development, but this can interfere with dynamic imports that expect specific module paths.

## Alternative Solutions (If Above Doesn't Work)

### Option 1: Downgrade to Mermaid 9.x
```bash
npm install mermaid@9
```
Mermaid 9 doesn't use dynamic imports for diagram types.

### Option 2: Use Static Import in mermaidConfig.ts
If using TypeScript with strict mode:
```typescript
import mermaid from 'mermaid/dist/mermaid.esm.mjs';
```

### Option 3: Add to resolve.alias
```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: {
      'mermaid': 'mermaid/dist/mermaid.esm.mjs'
    }
  }
});
```

## Verification Checklist

- [ ] Vite cache cleared
- [ ] Development server restarted
- [ ] No 404 errors in console
- [ ] Mermaid diagrams render correctly
- [ ] "Fix Mermaid" button works without errors
- [ ] Sequence diagrams load properly
- [ ] Flowchart diagrams load properly
- [ ] Other diagram types (gantt, class, etc.) load properly

## Related Issues

- Mermaid dynamic imports: https://github.com/mermaid-js/mermaid/issues/3神圣
- Vite optimizeDeps: https://vitejs.dev/config/dep-optimization-options.html

## Status

✅ Fix applied to `vite.config.ts`
✅ Vite cache cleared
⏳ Waiting for server restart to test
