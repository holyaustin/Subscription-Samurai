import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

interface BalanceResponse {
  success: boolean;
  address?: string;
  balance?: {
    balances: {
      USDT: string;
    };
  };
  error?: string;
}

// Helper to read/write .env.local
async function getOrCreateMnemonic(): Promise<string> {
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';
  
  try {
    envContent = await fs.readFile(envPath, 'utf8');
  } catch (error) {
    // File doesn't exist, we'll create it
  }
  
  // Check if mnemonic exists in env
  const match = envContent.match(/WALLET_MNEMONIC=([^\n]+)/);
  if (match) {
    return match[1];
  }
  
  // Generate new mnemonic
  console.log('No WALLET_MNEMONIC found, generating new one...');
  const newMnemonic = WDK.getRandomSeedPhrase();
  
  // Save to .env.local
  const newEnvContent = envContent + `\nWALLET_MNEMONIC=${newMnemonic}`;
  await fs.writeFile(envPath, newEnvContent);
  
  console.log('✅ New wallet mnemonic generated and saved to .env.local');
  return newMnemonic;
}

export async function GET(request: NextRequest): Promise<NextResponse<BalanceResponse>> {
  try {
    // Get or create mnemonic
    const mnemonic = await getOrCreateMnemonic();
    
    // Initialize WDK with the mnemonic
    const wdk = new WDK(mnemonic);
    
    // Register EVM wallet
    wdk.registerWallet('evm', WalletManagerEvm, {
      provider: process.env.RPC_URL || 'https://eth.drpc.org'
    });
    
    // Get the first account
    const account = await wdk.getAccount('evm', 0);
    const address = await account.getAddress();
    
    // Get balance
    const balanceWei = await account.getBalance();
    const balanceEth = Number(balanceWei) / 1e18;
    
    return NextResponse.json({
      success: true,
      address,
      balance: {
        balances: {
          USDT: balanceEth.toFixed(4)
        }
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('Balance fetch error:', errorMessage);
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage 
      },
      { status: 500 }
    );
  }
}