// This version uses the browser-compatible WDK
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

// Note: For browser environment, we need to use the browser build
// WDK automatically uses WebAssembly in browser environments

export async function initializeWallet(mnemonic?: string) {
  try {
    let seedPhrase: string;
    
    if (mnemonic) {
      seedPhrase = mnemonic;
    } else if (process.env.WALLET_MNEMONIC) {
      seedPhrase = process.env.WALLET_MNEMONIC;
    } else {
      // Generate new seed phrase
      seedPhrase = WDK.getRandomSeedPhrase();
      console.log('Generated new seed phrase');
    }

    // Create WDK instance
    const wdk = new WDK(seedPhrase);
    
    // Register EVM wallet module
    wdk.registerWallet('evm', WalletManagerEvm, {
      provider: process.env.RPC_URL || 'https://eth.drpc.org'
    });

    // Get account
    const account = await wdk.getAccount('evm', 0);
    const address = await account.getAddress();
    const balance = await account.getBalance();

    return {
      wdk,
      account,
      address,
      balance: balance.toString(),
      seedPhrase
    };
  } catch (error) {
    console.error('Failed to initialize wallet:', error);
    throw error;
  }
}