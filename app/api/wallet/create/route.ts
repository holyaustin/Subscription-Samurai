/**
 * POST /api/wallet/create
 *
 * Creates (or loads) the wallet and returns the Ethereum address.
 * The mnemonic is auto-generated and persisted to .env.local by
 * initializeWallet() if one does not already exist.
 *
 * WDK flow (per docs):
 *   1. WDK.getRandomSeedPhrase()              ← called inside initializeWallet
 *   2. new WalletManagerEvm(seedPhrase, cfg)  ← standalone EVM manager
 *   3. account = await walletManager.getAccount(0)
 *   4. address = await account.getAddress()
 */

import { NextResponse } from 'next/server';
import { initializeWallet } from '@/app/lib/wdk/client';

export async function POST() {
  try {
    const { address, seedPhrase } = await initializeWallet();

    return NextResponse.json({
      success: true,
      address,
      // Expose just the first word as a hint so the UI can confirm a new wallet
      // was generated — never send the full seed phrase to the browser in production.
      hint: `Seed phrase starts with: "${seedPhrase.split(' ')[0]} ..."`,
      message: 'Wallet ready. Seed phrase saved to .env.local.',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[/api/wallet/create] Error:', errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
