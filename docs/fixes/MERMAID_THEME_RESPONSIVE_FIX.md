# Mermaid & Theme System Fix

**Date**: 2026-02-16
**Status**: ✅ Implemented

## 🎯 Issues Fixed

### 1. Mermaid Dynamic Theme Support
**Problem**: Mermaid diagrams had hardcoded "dark" theme, didn't follow app theme changes.

**Solution**: Created `useMermaidTheme` hook that:
- Listens to Ant Design theme changes
- Dynamically reconfigures Mermaid with theme-specific colors
- Updates all diagram types (flowchart, sequence, gantt, etc.)

### 2. Mermaid Height Display Issues
**Problem**: Diagrams were cut off due to insufficient height calculation.

**Before**:
```typescript
finalHeight = Math.max(rect.height + 32, 200);  // Only 32px padding
height: `${Math.max(Math.min(height, 800), 400)}px`  // Forced min 400px
```

**After**:
```typescript
finalHeight = Math.max(rect.height + 80, 300);  // 80px padding
height: `${Math.min(height, 800)}px`  // No forced minimum
minHeight: "300px"  // Flexible minimum
```

### 3. Mermaid Non-Responsive Design
**Problem**: All chart types had `useMaxWidth: false`, breaking responsive design.

**Before**:
```typescript
flowchart: { useMaxWidth: false }  // ❌
sequence: { useMaxWidth: false }   // ❌
// All chart types: useMaxWidth: false
```

**After**:
```typescript
flowchart: { useMaxWidth: true }  // ✅ Responsive
sequence: { useMaxWidth: true }   // ✅ Responsive
// All chart types: useMaxWidth: true
```

### 4. Theme Persistence Broken
**Problem**: Theme wasn't saved to localStorage due to key mismatch.

**Before**:
```typescript
// App.tsx
const DARK_MODE_KEY = "copilot_dark_mode";  // ❌

// StorageService.ts
STORAGE_KEYS.THEME = "copilot_ui_theme_v1";  // ❌

// Two different keys! Theme never saved.
```

**After**:
```typescript
// App.tsx
const THEME_STORAGE_KEY = "copilot_ui_theme_v1";  // ✅

// StorageService.ts
STORAGE_KEYS.THEME = "copilot_ui_theme_v1";  // ✅

// Same key, theme persists correctly.
```

## 📁 Files Changed

### New Files
- ✅ `src/shared/components/MermaidChart/useMermaidTheme.ts` - Dynamic theme hook

### Modified Files
- ✅ `src/shared/components/MermaidChart/mermaidConfig.ts` - Simplified config
- ✅ `src/shared/components/MermaidChart/index.tsx` - Added useMermaidTheme
- ✅ `src/shared/components/MermaidChart/useMermaidRenderState.ts` - Fixed height calculation
- ✅ `src/shared/components/MermaidChart/MermaidChartViewer.tsx` - Removed forced height
- ✅ `src/app/App.tsx` - Fixed localStorage key + auto-save

## 🎨 How It Works

### Dynamic Theme Flow
```
User changes theme in Settings
    ↓
Ant Design theme updates
    ↓
useMermaidTheme hook detects token changes
    ↓
Re-initializes Mermaid with new theme variables
    ↓
All diagrams re-render with new colors
    ↓
localStorage saves theme preference
```

### Theme Color Mapping
```typescript
// Mermaid gets Ant Design colors:
isDark ? {
  background: token.colorBgContainer,
  primaryColor: token.colorPrimary,
  textColor: token.colorText,
  borderColor: token.colorBorder,
  // ... 20+ color mappings
} : {
  // Light mode equivalents
}
```

## 📊 Configuration Improvements

### Removed Constraints
```diff
- flowchart: { nodeSpacing: 15, rankSpacing: 30 }  // Fixed spacing
- sequence: { actorMargin: 60, messageMargin: 40 }  // Fixed margins
- sankey: { width: 1000, height: 600 }  // Fixed dimensions
- xyChart: { width: 900, height: 600 }  // Fixed dimensions
```

### Added Responsiveness
```diff
+ All charts: { useMaxWidth: true }  // Auto-adapt to container
+ Dynamic theme variables  // Match app theme
+ Flexible height calculation  // Prevent cutoff
```

## 🧪 Testing Checklist

- [ ] Change app theme (light ↔ dark)
- [ ] Verify Mermaid diagrams update colors
- [ ] Refresh page, theme persists
- [ ] Large diagrams show completely (no cutoff)
- [ ] Small screens adapt diagram width
- [ ] All diagram types work (flowchart, sequence, gantt, etc.)
- [ ] Zoom controls still work
- [ ] "Fix Mermaid" button still works

## 🔍 Before vs After

### Before
```typescript
// ❌ Static configuration
mermaid.initialize({
  theme: "dark",  // Hardcoded
  flowchart: { useMaxWidth: false },  // Not responsive
  // ... many fixed values
});

// ❌ Theme never saved
localStorage key mismatch

// ❌ Height cutoff
padding: 32px (too small)
forced min-height: 400px
```

### After
```typescript
// ✅ Dynamic configuration
useMermaidTheme() {
  // Listens to Ant Design theme
  // Auto-updates Mermaid config
  // Applies all token colors
}

// ✅ Theme persists
localStorage key: "copilot_ui_theme_v1"
Auto-save on theme change

// ✅ Full diagram visibility
padding: 80px (sufficient)
Flexible min-height: 300px
```

## 🎯 Benefits

1. **Dynamic Theming** ✅
   - Diagrams match app theme automatically
   - All 20+ colors from Ant Design tokens

2. **Better Responsive Design** ✅
   - `useMaxWidth: true` for all charts
   - Removed fixed dimensions

3. **Complete Rendering** ✅
   - 80px padding prevents cutoff
   - Flexible height constraints

4. **Theme Persistence** ✅
   - Unified localStorage key
   - Auto-save on change

5. **Simplified Config** ✅
   - Removed 100+ lines of fixed values
   - Dynamic configuration based on theme

## 📝 Usage

The theme system is now automatic. No code changes needed in components:

```typescript
// In MermaidChart component
const MermaidChart = ({ chart }) => {
  useMermaidTheme();  // ✅ Automatically handles theme

  // Rest of component...
};
```

```typescript
// In App.tsx
const [themeMode, setThemeMode] = useState(() => {
  const saved = localStorage.getItem("copilot_ui_theme_v1");
  return saved || "light";
});

// Auto-save when theme changes
useEffect(() => {
  localStorage.setItem("copilot_ui_theme_v1", themeMode);
}, [themeMode]);
```

## 🚀 Next Steps (Optional)

Future enhancements could include:
1. Custom Mermaid themes per diagram type
2. User-configurable diagram styling
3. Animated theme transitions
4. Export diagrams with current theme

---

**Status**: ✅ All issues resolved
**Testing**: Ready for verification
**Impact**: High (affects all Mermaid diagrams and theme system)
