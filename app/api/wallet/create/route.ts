/**
 * POST /api/wallet/create
 *
 * Local dev: generates a mnemonic and saves it to .env.local
 * Vercel:    cannot write files — returns the generated mnemonic so the user
 *            can copy it into their Vercel environment variables manually.
 */

import { NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

const isVercel = !!process.env.VERCEL;

export async function POST() {
  try {
    // If mnemonic already exists, just return the wallet address
    if (process.env.WALLET_MNEMONIC) {
      const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
      const wdkInstance = new WDK(process.env.WALLET_MNEMONIC)
        .registerWallet('ethereum', WalletManagerEvm, { provider });
      const account = await wdkInstance.getAccount('ethereum', 0);
      const address = await account.getAddress();

      return NextResponse.json({
        success: true,
        address,
        message: 'Wallet already exists.',
      });
    }

    // Generate a new mnemonic
    const newMnemonic = WDK.getRandomSeedPhrase();

    if (isVercel) {
      // On Vercel we can't write files — tell the user what to do
      const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
      const wdkInstance = new WDK(newMnemonic)
        .registerWallet('ethereum', WalletManagerEvm, { provider });
      const account = await wdkInstance.getAccount('ethereum', 0);
      const address = await account.getAddress();

      return NextResponse.json({
        success: true,
        address,
        vercel_action_required: true,
        instructions: [
          '1. Copy the WALLET_MNEMONIC value below',
          '2. Go to Vercel → Your Project → Settings → Environment Variables',
          '3. Add: WALLET_MNEMONIC = <the value below>',
          '4. Click Save, then go to Deployments and Redeploy',
          '5. Your wallet will be ready after redeployment',
        ],
        // Safe to return here — user needs this to set the env var
        // In production you would handle this differently (e.g. encrypt it)
        WALLET_MNEMONIC: newMnemonic,
        message: 'Action required: add WALLET_MNEMONIC to Vercel environment variables (see instructions)',
      });
    }

    // Local dev: save to .env.local
    const { promises: fs } = await import('fs');
    const { join } = await import('path');
    const envPath = join(process.cwd(), '.env.local');
    let envContent = '';
    try { envContent = await fs.readFile(envPath, 'utf8'); } catch { /* ok */ }

    if (!envContent.includes('WALLET_MNEMONIC=')) {
      const sep = envContent.length > 0 && !envContent.endsWith('\n') ? '\n' : '';
      await fs.writeFile(envPath, `${envContent}${sep}WALLET_MNEMONIC=${newMnemonic}\n`);
      process.env.WALLET_MNEMONIC = newMnemonic;
    }

    const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
    const wdkInstance = new WDK(newMnemonic)
      .registerWallet('ethereum', WalletManagerEvm, { provider });
    const account = await wdkInstance.getAccount('ethereum', 0);
    const address = await account.getAddress();

    return NextResponse.json({
      success: true,
      address,
      message: 'Wallet created and saved to .env.local. Restart npm run dev to load it.',
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[create] Fatal:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}