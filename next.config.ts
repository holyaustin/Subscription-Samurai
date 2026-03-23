import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    '@tetherto/wdk',
    '@tetherto/wdk-wallet-evm',
    'sodium-native',
    'sodium-universal',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // At bundle time, redirect sodium packages to our pure-JS stubs.
      // This handles both direct imports and transitive requires.
      config.resolve.alias = {
        ...config.resolve.alias,
        'sodium-native':    path.resolve('./mocks/sodium-native-pkg/index.js'),
        'sodium-universal': path.resolve('./mocks/sodium-universal-pkg/index.js'),
      };
    }
    return config;
  },
};

export default nextConfig;