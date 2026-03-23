/**
 * scripts/patch-sodium.js
 *
 * Runs automatically after every `npm install` via the "postinstall" hook.
 *
 * Copies our pure-JS stubs over the real sodium-native and sodium-universal
 * packages in node_modules. This ensures that:
 *   1. No native .node binary is ever loaded (works on Vercel)
 *   2. WDK's named imports from sodium-universal resolve correctly
 *   3. The Webpack alias in next.config.ts catches any remaining references
 *
 * This is more reliable than npm "overrides" because it directly replaces
 * the files rather than relying on npm's resolution algorithm.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function patchPackage(pkgName, stubDir) {
  const target = path.join(ROOT, 'node_modules', pkgName);

  if (!fs.existsSync(target)) {
    console.log(`[patch-sodium] ${pkgName} not in node_modules — skipping`);
    return;
  }

  const stubIndex = path.join(ROOT, stubDir, 'index.js');
  const stubPkg   = path.join(ROOT, stubDir, 'package.json');

  if (!fs.existsSync(stubIndex)) {
    console.error(`[patch-sodium] Stub not found: ${stubIndex}`);
    process.exit(1);
  }

  // Remove everything in the target directory
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  // Copy stub files
  fs.copyFileSync(stubIndex, path.join(target, 'index.js'));
  fs.copyFileSync(stubPkg,   path.join(target, 'package.json'));

  console.log(`[patch-sodium] ✅ Patched ${pkgName} with pure-JS stub`);
}

patchPackage('sodium-native',    'mocks/sodium-native-pkg');
patchPackage('sodium-universal', 'mocks/sodium-universal-pkg');

console.log('[patch-sodium] Done. Both sodium packages replaced with pure-JS stubs.');