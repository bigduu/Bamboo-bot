# Mermaid User Settings Page

**Date**: 2026-02-16
**Status**: ✅ Implemented

## 🎯 Purpose

Allow users to customize Mermaid diagram rendering settings through the Settings UI, solving the issue where diagrams were too small or hard to read after recent changes.

## 📁 New Files Created

### 1. `src/shared/store/mermaidSettingsStore.ts`
Zustand store for persisting Mermaid configuration settings.

**Features**:
- ✅ Persistent storage (localStorage)
- ✅ Type-safe configuration
- ✅ Reset to defaults functionality
- ✅ Partial updates support

**Configuration Options**:
```typescript
interface MermaidSettings {
  // Global
  fontSize: number;                    // 16 (default)
  defaultScale: number;                // 1.0 (default)
  useMaxWidth: boolean;                // true (default)

  // Flowchart
  flowchartNodeSpacing: number;        // 50
  flowchartRankSpacing: number;        // 50
  flowchartCurve: 'basis' | 'linear' | 'cardinal';

  // Sequence
  sequenceActorMargin: number;         // 50
  sequenceMessageMargin: number;       // 35
  sequenceWidth: number;               // 150
  sequenceHeight: number;              // 65

  // Gantt
  ganttBarHeight: number;              // 20
  ganttTopPadding: number;             // 50

  // Theme
  customBackground?: string;           // Optional
  customPrimaryColor?: string;         // Optional
}
```

### 2. `src/pages/SettingsPage/components/SystemSettingsPage/MermaidSettingsTab.tsx`
React component for editing Mermaid settings.

**UI Sections**:
1. **Global Settings**
   - Font Size (10-32px)
   - Default Zoom (0.1-3.0x)
   - Responsive Width toggle

2. **Flowchart Settings**
   - Node Spacing (20-200)
   - Rank Spacing (20-200)
   - Curve Type (Smooth/Linear/Cardinal)

3. **Sequence Diagram Settings**
   - Actor Margin (20-200)
   - Message Margin (10-100)
   - Actor Width (100-300)
   - Actor Height (40-150)

4. **Gantt Chart Settings**
   - Bar Height (10-50px)
   - Top Padding (20-100)

5. **Advanced Theme Overrides**
   - Custom Background Color
   - Custom Primary Color

**Features**:
- ✅ Real-time preview
- ✅ Tooltips explaining each setting
- ✅ Reset to defaults button
- ✅ Form validation
- ✅ Immediate application

## 📝 Modified Files

### 1. `src/shared/components/MermaidChart/useMermaidTheme.ts`
**Changes**: Read user settings from store and apply to Mermaid configuration

```typescript
// Before: Hard-coded values
fontSize: token.fontSize,
flowchart: {
  nodeSpacing: 50,
  rankSpacing: 50,
}

// After: User-configurable
fontSize: userSettings.fontSize,
flowchart: {
  nodeSpacing: userSettings.flowchartNodeSpacing,
  rankSpacing: userSettings.flowchartRankSpacing,
}
```

### 2. `src/shared/components/MermaidChart/index.tsx`
**Changes**: Use user-configured default zoom level

```typescript
// Before: Hard-coded scaling
if (svgWidth > 1200) return 0.8;

// After: User-configured base scale
const baseScale = userSettings.defaultScale;
if (svgWidth > 1200) return baseScale * 0.8;
```

### 3. `src/app/MainLayout.tsx`
**Changes**: Clear Mermaid cache when user settings change

```typescript
// New: Watch user settings and clear cache
useEffect(() => {
  console.log("🔄 Mermaid settings changed, clearing cache");
  mermaidCache.clear();
}, [mermaidSettings]);
```

### 4. `src/pages/SettingsPage/components/SystemSettingsPage/index.tsx`
**Changes**: Add "Mermaid" tab to settings navigation

```typescript
{
  key: "mermaid",
  label: "Mermaid",
  children: <MermaidSettingsTab />,
}
```

## 🎨 UI Preview

```
┌─────────────────────────────────────────────┐
│ Mermaid Diagram Settings                     │
│ Customize how Mermaid diagrams are rendered  │
├─────────────────────────────────────────────┤
│ Global Settings                              │
│ ┌─────────────────┬─────────────────┐       │
│ │ Font Size: 16px │ Default Zoom: 1.0│       │
│ └─────────────────┴─────────────────┘       │
│ ☑ Responsive Width (Auto/Fixed)             │
├─────────────────────────────────────────────┤
│ Flowchart Settings                           │
│ ┌───────────────────────────────────────┐   │
│ │ Node Spacing: 50  Rank Spacing: 50   │   │
│ │ Curve Type: [Smooth ▼]                │   │
│ └───────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│ ... (Sequence, Gantt, etc.)                  │
├─────────────────────────────────────────────┤
│ [Reset to Defaults]                          │
└─────────────────────────────────────────────┘
```

## 🔄 How It Works

### Flow
```
User changes setting in UI
    ↓
Form triggers onValuesChange
    ↓
updateSettings() updates Zustand store
    ↓
Store persists to localStorage
    ↓
MermaidSettings changed
    ↓
MainLayout detects change
    ↓
Clears mermaidCache
    ↓
useMermaidTheme re-initializes Mermaid
    ↓
New settings applied
    ↓
Diagrams re-render with new config
```

### Cache Clearing Strategy
- **Theme Change**: Clear cache → Re-render all charts
- **Settings Change**: Clear cache → Re-render all charts
- **Why?**: Ensure all charts use the latest configuration

## 🎯 Benefits

### For Users
- ✅ Adjust font size for readability
- ✅ Set comfortable zoom level
- ✅ Customize spacing for different diagram types
- ✅ Override theme colors if needed
- ✅ Reset to defaults anytime

### For Developers
- ✅ Centralized configuration management
- ✅ Type-safe settings with TypeScript
- ✅ Persistent across sessions
- ✅ Easy to extend with new options

## 📊 Default Values

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `fontSize` | 16px | 10-32 | Base text size |
| `defaultScale` | 1.0 | 0.1-3.0 | Initial zoom |
| `useMaxWidth` | true | boolean | Responsive width |
| `flowchartNodeSpacing` | 50 | 20-200 | Horizontal node gap |
| `flowchartRankSpacing` | 50 | 20-200 | Vertical layer gap |
| `sequenceActorMargin` | 50 | 20-200 | Actor spacing |
| `ganttBarHeight` | 20 | 10-50 | Task bar height |

## 🧪 Testing Checklist

- [ ] Settings page opens without errors
- [ ] Font size changes apply immediately
- [ ] Default zoom affects new diagrams
- [ ] Responsive width toggle works
- [ ] Flowchart spacing updates visible
- [ ] Sequence diagram spacing updates
- [ ] Gantt chart settings apply
- [ ] Theme color overrides work
- [ ] Reset button restores defaults
- [ ] Settings persist after page reload
- [ ] Cache clearing works correctly

## 🐛 Known Issues & Solutions

### Issue: InputNumber for color fields
**Problem**: Originally used `InputNumber` for hex color strings
**Solution**: Changed to `Select` with predefined color options

### Issue: Settings not applying
**Problem**: Cache not cleared on settings change
**Solution**: Added useEffect to watch `mermaidSettings` in MainLayout

## 🚀 Future Enhancements

Possible additions:
1. Color picker for custom colors
2. Per-diagram-type presets
3. Import/export settings
4. Preview diagram in settings
5. Animation settings
6. Custom CSS injection

## 📚 Usage Guide

### Accessing Settings
1. Open Settings (gear icon)
2. Click "Mermaid" tab
3. Adjust settings as needed
4. Changes apply immediately

### Recommended Settings

**For Small Screens**:
- Font Size: 14px
- Default Zoom: 0.8
- Responsive Width: ON

**For Large Monitors**:
- Font Size: 18px
- Default Zoom: 1.2
- Node Spacing: 80
- Rank Spacing: 80

**For Dense Diagrams**:
- Node Spacing: 30
- Actor Margin: 30
- Bar Height: 15

---

**Status**: ✅ Complete and ready for testing
**Impact**: High - Directly improves user experience with diagrams
