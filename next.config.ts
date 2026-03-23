import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Tell Next.js not to bundle these — leave as external require() calls
  serverExternalPackages: [
    '@tetherto/wdk',
    '@tetherto/wdk-wallet-evm',
    'sodium-native',
    'sodium-universal',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Redirect both sodium packages to our pure-JS stubs at bundle time.
      // This works even when serverExternalPackages doesn't fully prevent
      // the bundler from touching transitive deps.
      config.resolve.alias = {
        ...config.resolve.alias,
        'sodium-native':    path.resolve(__dirname, 'mocks/sodium-native-pkg/index.js'),
        'sodium-universal': path.resolve(__dirname, 'mocks/sodium-universal-pkg/index.js'),
      };
    }
    return config;
  },
};

export default nextConfig;