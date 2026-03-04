/**
 * Rebranding Script
 *
 * This script automatically rebrands the application for different targets:
 * - public: For public releases (GitHub, distribution)
 * - internal: For internal development
 *
 * Usage:
 *   node scripts/rebrand.cjs --target=public
 *   node scripts/rebrand.cjs --target=internal
 *   node scripts/rebrand.cjs --target=public --check
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  return argv.reduce((acc, arg) => {
    if (!arg.startsWith("--")) return acc;

    const raw = arg.slice(2);
    const eqIndex = raw.indexOf("=");
    if (eqIndex === -1) {
      // Boolean flag: `--check`
      acc[raw] = true;
      return acc;
    }

    const key = raw.slice(0, eqIndex);
    const value = raw.slice(eqIndex + 1);
    acc[key] = value;
    return acc;
  }, {});
}

// Parse command line arguments
const args = parseArgs(process.argv.slice(2));

const target = args.target || "internal";
const checkOnly = Boolean(args.check);

// Branding configurations
const BRANDS = {
  public: {
    // Public-facing names (for releases, GitHub, etc.)
    productName: "Bamboo",
    windowTitle: "Bamboo",
    packageName: "bamboo",
    identifier: "com.bamboo.app",
    htmlTitle: "Bamboo",
    systemPromptName: "Bamboo",
    systemPromptContent: "You are Bamboo",
  },
  internal: {
    // Internal development names
    productName: "Bodhi",
    windowTitle: "Bodhi",
    packageName: "bodhi",
    identifier: "com.bodhi.app",
    htmlTitle: "Bodhi",
    systemPromptName: "Bodhi",
    systemPromptContent: "You are Bodhi",
  },
};

const brand = BRANDS[target];

if (!brand) {
  console.error(`❌ Unknown target: ${target}`);
  console.error(`   Valid targets: ${Object.keys(BRANDS).join(", ")}`);
  process.exit(1);
}

console.log(
  `\n🎨 ${checkOnly ? "Checking branding for" : "Rebranding to"}: ${target.toUpperCase()}`,
);
console.log(`   Product Name: ${brand.productName}`);
console.log(`   Package Name: ${brand.packageName}\n`);

const results = [];
function recordResult(result) {
  results.push(result);
}

function finalizeAndExit() {
  const failures = results.filter((r) => !r.ok);
  const warnings = results.filter((r) => r.level === "warn");

  if (warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${warnings.length}`);
    warnings.forEach((w) => console.log(`   - ${w.message}`));
  }

  if (failures.length > 0) {
    console.error(`\n❌ Failed steps: ${failures.length}`);
    failures.forEach((f) => console.error(`   - ${f.message}`));
    process.exit(1);
  }

  console.log(
    `\n✨ ${checkOnly ? "Branding check passed" : "Rebranding complete"}! Target: ${target}\n`,
  );
  process.exit(0);
}

function parsePathSegments(pathStr) {
  return pathStr.split(".").map((seg) => {
    if (/^\d+$/.test(seg)) return Number(seg);
    return seg;
  });
}

function getAtPath(root, pathStr, filePath) {
  const segments = parsePathSegments(pathStr);
  let cur = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segLabel = typeof seg === "number" ? `[${seg}]` : `.${seg}`;

    if (cur == null) {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: cannot traverse ${segLabel} because parent is null/undefined`,
      );
    }

    if (typeof seg === "number") {
      if (!Array.isArray(cur)) {
        throw new Error(
          `Invalid JSON path "${pathStr}" in ${filePath}: expected an array before index ${seg}`,
        );
      }
      if (seg < 0 || seg >= cur.length) {
        throw new Error(
          `Invalid JSON path "${pathStr}" in ${filePath}: array index ${seg} is out of bounds (len=${cur.length})`,
        );
      }
      cur = cur[seg];
      continue;
    }

    if (typeof cur !== "object") {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: expected an object before key "${seg}"`,
      );
    }
    if (!(seg in cur)) {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: missing key "${seg}"`,
      );
    }
    cur = cur[seg];
  }
  return cur;
}

function setAtPath(root, pathStr, value, filePath) {
  const segments = parsePathSegments(pathStr);
  if (segments.length === 0) {
    throw new Error(
      `Invalid JSON path "${pathStr}" in ${filePath}: empty path`,
    );
  }

  let cur = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];

    if (cur == null) {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: cannot traverse because parent is null/undefined`,
      );
    }

    if (typeof seg === "number") {
      if (!Array.isArray(cur)) {
        throw new Error(
          `Invalid JSON path "${pathStr}" in ${filePath}: expected an array before index ${seg}`,
        );
      }
      if (seg < 0 || seg >= cur.length) {
        throw new Error(
          `Invalid JSON path "${pathStr}" in ${filePath}: array index ${seg} is out of bounds (len=${cur.length})`,
        );
      }
      cur = cur[seg];
      continue;
    }

    if (typeof cur !== "object") {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: expected an object before key "${seg}"`,
      );
    }
    if (!(seg in cur)) {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: missing key "${seg}"`,
      );
    }
    cur = cur[seg];
  }

  const last = segments[segments.length - 1];
  if (typeof last === "number") {
    if (!Array.isArray(cur)) {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: expected an array before index ${last}`,
      );
    }
    if (last < 0 || last >= cur.length) {
      throw new Error(
        `Invalid JSON path "${pathStr}" in ${filePath}: array index ${last} is out of bounds (len=${cur.length})`,
      );
    }
    cur[last] = value;
    return;
  }

  if (typeof cur !== "object" || cur == null) {
    throw new Error(
      `Invalid JSON path "${pathStr}" in ${filePath}: expected an object before key "${last}"`,
    );
  }
  if (!(last in cur)) {
    throw new Error(
      `Invalid JSON path "${pathStr}" in ${filePath}: missing key "${last}"`,
    );
  }
  cur[last] = value;
}

function countMatches(content, pattern) {
  if (!(pattern instanceof RegExp)) {
    throw new Error(`Replacement pattern must be a RegExp`);
  }

  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : pattern.flags + "g";
  const global = new RegExp(pattern.source, flags);
  return Array.from(content.matchAll(global)).length;
}

/**
 * Update JSON file while preserving formatting
 */
function updateJSON(filePath, updates) {
  const fullPath = path.resolve(__dirname, "..", filePath);

  if (!fs.existsSync(fullPath)) {
    const message = `File not found: ${filePath}`;
    console.log(`⚠️  ${message}`);
    return { ok: false, message };
  }

  try {
    const content = fs.readFileSync(fullPath, "utf8");
    const data = JSON.parse(content);

    // Apply updates
    let changed = false;
    Object.keys(updates).forEach((key) => {
      const existing = getAtPath(data, key, filePath);
      const next = updates[key];
      if (existing !== next) {
        changed = true;
      }
    });

    if (checkOnly) {
      if (changed) {
        return {
          ok: false,
          message: `Branding mismatch in ${filePath} (JSON values differ from target)`,
        };
      }
      console.log(`✅ OK: ${filePath}`);
      return { ok: true, message: `OK: ${filePath}`, changed: false };
    }

    if (!changed) {
      console.log(`✅ No change: ${filePath}`);
      return { ok: true, message: `No change: ${filePath}`, changed: false };
    }

    Object.keys(updates).forEach((key) => {
      setAtPath(data, key, updates[key], filePath);
    });

    // Write back with proper formatting
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + "\n");
    console.log(`✅ Updated: ${filePath}`);
    return { ok: true, message: `Updated: ${filePath}`, changed: true };
  } catch (error) {
    const message = `Failed to update ${filePath}: ${error.message}`;
    console.error(`❌ ${message}`);
    return { ok: false, message };
  }
}

/**
 * Update text file with regex replacements
 */
function updateFile(filePath, replacements) {
  const fullPath = path.resolve(__dirname, "..", filePath);

  if (!fs.existsSync(fullPath)) {
    const message = `File not found: ${filePath}`;
    console.log(`⚠️  ${message}`);
    return { ok: false, message };
  }

  try {
    const original = fs.readFileSync(fullPath, "utf8");
    let content = original;

    for (const { pattern, replacement, description } of replacements) {
      const matches = countMatches(content, pattern);
      if (matches === 0) {
        const desc = description ? ` (${description})` : "";
        return {
          ok: false,
          message: `No matches for pattern in ${filePath}${desc}: ${pattern}`,
        };
      }
      content = content.replace(pattern, replacement);
    }

    const changed = content !== original;

    if (checkOnly) {
      if (changed) {
        return {
          ok: false,
          message: `Branding mismatch in ${filePath} (file contents differ from target)`,
        };
      }
      console.log(`✅ OK: ${filePath}`);
      return { ok: true, message: `OK: ${filePath}`, changed: false };
    }

    if (changed) {
      fs.writeFileSync(fullPath, content);
      console.log(`✅ Updated: ${filePath}`);
      return { ok: true, message: `Updated: ${filePath}`, changed: true };
    }

    // Already matches target.
    console.log(`✅ No change: ${filePath}`);
    return { ok: true, message: `No change: ${filePath}`, changed: false };
  } catch (error) {
    const message = `Failed to update ${filePath}: ${error.message}`;
    console.error(`❌ ${message}`);
    return { ok: false, message };
  }
}

function updateTauriWindowTitles(filePath, title) {
  const fullPath = path.resolve(__dirname, "..", filePath);

  if (!fs.existsSync(fullPath)) {
    const message = `File not found: ${filePath}`;
    console.log(`⚠️  ${message}`);
    return { ok: false, message };
  }

  try {
    const content = fs.readFileSync(fullPath, "utf8");
    const data = JSON.parse(content);

    const windowsPath = "app.windows";
    const windows = getAtPath(data, windowsPath, filePath);
    if (!Array.isArray(windows)) {
      return {
        ok: false,
        message: `Invalid ${filePath}: "${windowsPath}" is not an array`,
      };
    }

    const changed = windows.some(
      (w) => w && typeof w === "object" && w.title !== title,
    );

    if (checkOnly) {
      if (changed) {
        return {
          ok: false,
          message: `Branding mismatch in ${filePath} (one or more window titles differ from target)`,
        };
      }
      console.log(`✅ OK: ${filePath} (all window titles)`);
      return {
        ok: true,
        message: `OK: ${filePath} (all window titles)`,
        changed: false,
      };
    }

    if (!changed) {
      console.log(`✅ No change: ${filePath} (all window titles)`);
      return {
        ok: true,
        message: `No change: ${filePath} (all window titles)`,
        changed: false,
      };
    }

    windows.forEach((w, idx) => {
      if (!w || typeof w !== "object") {
        throw new Error(`Invalid window entry at app.windows[${idx}]`);
      }
      if (!("title" in w)) {
        throw new Error(`Missing "title" at app.windows[${idx}]`);
      }
      w.title = title;
    });

    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + "\n");
    console.log(`✅ Updated: ${filePath} (all window titles)`);
    return {
      ok: true,
      message: `Updated: ${filePath} (all window titles)`,
      changed: true,
    };
  } catch (error) {
    const message = `Failed to update ${filePath} (window titles): ${error.message}`;
    console.error(`❌ ${message}`);
    return { ok: false, message };
  }
}

// ===== Apply Branding =====

// 1. Update package.json
recordResult(
  updateJSON("package.json", {
    name: brand.packageName,
  }),
);

// 2. Update tauri.conf.json
recordResult(
  updateJSON("src-tauri/tauri.conf.json", {
    productName: brand.productName,
    identifier: brand.identifier,
  }),
);
recordResult(
  updateTauriWindowTitles("src-tauri/tauri.conf.json", brand.windowTitle),
);

// 3. Update index.html
recordResult(
  updateFile("index.html", [
    {
      description: "HTML title tag",
      pattern: /<title>[^<]*<\/title>/,
      replacement: `<title>${brand.htmlTitle}</title>`,
    },
  ]),
);

// 4. Update default system prompts
recordResult(
  updateFile("src/pages/ChatPage/utils/defaultSystemPrompts.ts", [
    {
      description: "Default prompt name (general_assistant)",
      pattern: /(id:\s*"general_assistant",[\s\S]*?\bname:\s*")[^"]*(")/,
      replacement: `$1${brand.systemPromptName}$2`,
    },
    {
      description: "Default prompt content prefix (general_assistant)",
      pattern:
        /(id:\s*"general_assistant",[\s\S]*?\bcontent:[\s\S]*?")You are (?:Bamboo|Bodhi|Default)/,
      replacement: `$1${brand.systemPromptContent}`,
    },
  ]),
);

// 5. Update system prompt tests
recordResult(
  updateFile(
    "src/pages/ChatPage/components/__tests__/SystemPromptSelector.test.tsx",
    [
      {
        description: "Test fixture name (general_assistant)",
        pattern: /(id:\s*"general_assistant",[\s\S]*?\bname:\s*")[^"]*(")/,
        replacement: `$1${brand.systemPromptName}$2`,
      },
      {
        description: "Test fixture content prefix (general_assistant)",
        pattern:
          /(id:\s*"general_assistant",[\s\S]*?\bcontent:\s*")You are (?:Bamboo|Bodhi|Default)/,
        replacement: `$1${brand.systemPromptContent}`,
      },
    ],
  ),
);

// 6. Create environment file for build-time constants
if (!checkOnly) {
  const envContent = `# Auto-generated by rebrand script - DO NOT EDIT MANUALLY
# Build-time environment variables

VITE_INTERNAL_BUILD=${target === "internal" ? "true" : "false"}
`;

  const envPath = path.resolve(__dirname, "..", ".env");
  try {
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Created: .env (${target} build)`);
  } catch (error) {
    console.error(`❌ Failed to create .env:`, error.message);
    recordResult({ ok: false, message: `Failed to create .env: ${error.message}` });
  }
} else {
  // In check mode, verify the .env file exists and has correct value
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const expectedValue = `VITE_INTERNAL_BUILD=${target === "internal" ? "true" : "false"}`;
    if (!envContent.includes(expectedValue)) {
      console.error(`❌ Branding mismatch in .env (expected ${expectedValue})`);
      recordResult({ ok: false, message: "Branding mismatch in .env" });
    } else {
      console.log(`✅ OK: .env`);
    }
  } else {
    console.log(`⚠️  .env file not found (will be created on next rebrand)`);
  }
}

if (!checkOnly) {
  // Write current brand to a file for reference (local-only; excluded from Git).
  const brandInfoPath = path.resolve(__dirname, "..", ".brand-info.json");
  fs.writeFileSync(
    brandInfoPath,
    JSON.stringify(
      {
        target,
        brand,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`📝 Brand info saved to: .brand-info.json\n`);
}

finalizeAndExit();
