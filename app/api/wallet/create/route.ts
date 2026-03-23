/**
 * POST /api/wallet/create
 *
 * Multi-user: generates a new WDK mnemonic and returns it to the client.
 * The client stores it in localStorage — it is NEVER saved on the server.
 *
 * Response: { success: true, mnemonic: string, address: string }
 *
 * The client is responsible for:
 * 1. Storing the mnemonic in localStorage
 * 2. Showing the user a backup warning
 * 3. Sending the mnemonic in subsequent API calls
 */

import { NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

export async function POST() {
  try {
    const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';

    // Generate a new BIP-39 mnemonic using WDK
    const mnemonic = WDK.getRandomSeedPhrase();

    // Derive the wallet address so the client can display it immediately
    const wdkInstance = new WDK(mnemonic)
      .registerWallet('ethereum', WalletManagerEvm, { provider });

    const account = await wdkInstance.getAccount('ethereum', 0);
    const address  = await account.getAddress();

    // Return mnemonic to client — client stores it in localStorage
    // Server does NOT persist this mnemonic anywhere
    return NextResponse.json({
      success: true,
      mnemonic,  // Client stores this in localStorage
      address,
      message: 'Wallet created. Store your seed phrase safely — it cannot be recovered if lost.',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[create] error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}