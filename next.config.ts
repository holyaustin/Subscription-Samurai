import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // These packages contain native C++ addons (.node files).
  // serverExternalPackages tells the bundler to leave them as external
  // require() calls so Node.js resolves them at runtime from node_modules.
  // This works correctly with Webpack (next build --webpack).
  // Turbopack has a known bug with transitive native dependencies in
  // Next.js 16.x canary builds — switching to Webpack fixes it.
  serverExternalPackages: [
    '@tetherto/wdk',
    '@tetherto/wdk-wallet-evm',
    'sodium-native',
  ],
};

export default nextConfig;