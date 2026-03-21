/**
 * GET /api/wallet/generate-mnemonic
 *
 * Generates a fresh BIP-39 seed phrase without persisting it.
 * Useful for showing the user a new phrase before they confirm wallet creation.
 *
 * WDK API (per docs):
 *   WDK.getRandomSeedPhrase()            → string  (12 words, default)
 *   WDK.getRandomSeedPhrase(24)          → string  (24 words)
 *
 *   Also available on WalletManagerEvm:
 *   WalletManagerEvm.getRandomSeedPhrase() → string
 *   WalletManagerEvm.isValidSeedPhrase(s)  → boolean
 */

import { NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';

export async function GET() {
  try {
    // Docs: static method — WDK.getRandomSeedPhrase() returns a 12-word BIP-39 phrase
    const mnemonic = WDK.getRandomSeedPhrase();

    return NextResponse.json({
      success: true,
      mnemonic,
      wordCount: mnemonic.split(' ').length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[/api/wallet/generate-mnemonic] Error:', errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
