/**
 * Rebranding Script
 *
 * This script automatically rebrands the application for different targets:
 * - public: For public releases (GitHub, distribution)
 * - internal: For internal development
 *
 * Usage:
 *   node scripts/rebrand.js --target=public
 *   node scripts/rebrand.js --target=internal
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

const target = args.target || 'internal';

// Branding configurations
const BRANDS = {
  public: {
    // Public-facing names (for releases, GitHub, etc.)
    productName: 'Bamboo',
    windowTitle: 'Bamboo',
    packageName: 'bamboo',
    htmlTitle: 'Bamboo',
    systemPromptName: 'Bamboo',
    systemPromptContent: 'You are Bamboo',
  },
  internal: {
    // Internal development names
    productName: 'Bodhi',
    windowTitle: 'Bodhi',
    packageName: 'bodhi',
    htmlTitle: 'Bodhi',
    systemPromptName: 'Default',
    systemPromptContent: 'You are Bodhi',
  },
};

const brand = BRANDS[target];

if (!brand) {
  console.error(`❌ Unknown target: ${target}`);
  console.error(`   Valid targets: ${Object.keys(BRANDS).join(', ')}`);
  process.exit(1);
}

console.log(`\n🎨 Rebranding to: ${target.toUpperCase()}`);
console.log(`   Product Name: ${brand.productName}`);
console.log(`   Package Name: ${brand.packageName}\n`);

/**
 * Update JSON file while preserving formatting
 */
function updateJSON(filePath, updates) {
  const fullPath = path.resolve(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(content);

    // Apply updates
    Object.keys(updates).forEach(key => {
      const keys = key.split('.');
      let obj = data;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = updates[key];
    });

    // Write back with proper formatting
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`✅ Updated: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Update text file with regex replacements
 */
function updateFile(filePath, replacements) {
  const fullPath = path.resolve(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  try {
    let content = fs.readFileSync(fullPath, 'utf8');

    replacements.forEach(({ pattern, replacement }) => {
      content = content.replace(pattern, replacement);
    });

    fs.writeFileSync(fullPath, content);
    console.log(`✅ Updated: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error.message);
    return false;
  }
}

// ===== Apply Branding =====

// 1. Update package.json
updateJSON('package.json', {
  'name': brand.packageName,
});

// 2. Update tauri.conf.json
updateJSON('src-tauri/tauri.conf.json', {
  'productName': brand.productName,
  'app.windows.0.title': brand.windowTitle,
});

// 3. Update index.html
updateFile('index.html', [
  {
    pattern: /<title>.*?<\/title>/,
    replacement: `<title>${brand.htmlTitle}</title>`,
  },
]);

// 4. Update default system prompts
updateFile('src/pages/ChatPage/utils/defaultSystemPrompts.ts', [
  {
    pattern: /name: ["'].*?["'],/,
    replacement: `name: "${brand.systemPromptName}",`,
  },
  {
    pattern: /You are (Bamboo|Bodhi|Default)/,
    replacement: brand.systemPromptContent,
  },
]);

// 5. Update system prompt tests
updateFile('src/pages/ChatPage/components/__tests__/SystemPromptSelector.test.tsx', [
  {
    pattern: /name: ["'](Bamboo|Bodhi|Default)["'],/g,
    replacement: `name: "${brand.systemPromptName}",`,
  },
  {
    pattern: /You are (Bamboo|Bodhi|Default)/g,
    replacement: brand.systemPromptContent,
  },
]);

console.log(`\n✨ Rebranding complete! Target: ${target}\n`);

// Write current brand to a file for reference
const brandInfoPath = path.resolve(__dirname, '..', '.brand-info.json');
fs.writeFileSync(
  brandInfoPath,
  JSON.stringify(
    {
      target,
      brand,
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  ) + '\n'
);
console.log(`📝 Brand info saved to: .brand-info.json\n`);
