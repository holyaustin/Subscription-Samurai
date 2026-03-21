import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

interface WalletInitResult {
  wdk: any;
  account: any;
  address: string;
  seedPhrase: string;
}

// Initialize WDK based on docs: https://docs.wdk.tether.io/start-building/nodejs-bare-quickstart
export async function initializeWallet(mnemonic?: string): Promise<WalletInitResult> {
  try {
    let seedPhrase: string;
    
    // Use provided mnemonic, existing one, or generate new
    if (mnemonic) {
      seedPhrase = mnemonic;
    } else if (process.env.WALLET_MNEMONIC) {
      seedPhrase = process.env.WALLET_MNEMONIC;
    } else {
      // Generate new seed phrase
      seedPhrase = WDK.getRandomSeedPhrase();
      console.log('Generated new seed phrase:', seedPhrase);
    }

    // Create WDK instance with seed phrase
    const wdk = new WDK(seedPhrase);
    
    // Register EVM wallet module
    wdk.registerWallet('evm', WalletManagerEvm, {
      provider: process.env.RPC_URL || 'https://eth.drpc.org'
    });

    // Get the first account (index 0)
    const account = await wdk.getAccount('evm', 0);
    const address = await account.getAddress();

    return { wdk, account, address, seedPhrase };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Failed to initialize wallet:', errorMessage);
    throw new Error(`Wallet initialization failed: ${errorMessage}`);
  }
}

// Get wallet balance using WDK account
export async function getWalletBalance(account: any) {
  try {
    // Use the account's getBalance method as shown in docs
    const balance = await account.getBalance();
    return {
      balances: {
        USDT: balance.toString() // Convert BigInt to string
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Balance check failed:', errorMessage);
    throw new Error(`Balance check failed: ${errorMessage}`);
  }
}

// Send transaction using WDK
export async function sendPayment(
  account: any,
  toAddress: string,
  amount: string,
  token: string = 'USDT'
) {
  try {
    // Convert amount to wei/smallest unit
    const value = BigInt(amount) * BigInt(10 ** 18);
    
    // Send transaction as shown in docs
    const result = await account.sendTransaction({
      to: toAddress,
      value: value
    });
    
    return {
      txId: result.hash,
      status: 'completed',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Payment failed:', errorMessage);
    throw new Error(`Payment failed: ${errorMessage}`);
  }
}