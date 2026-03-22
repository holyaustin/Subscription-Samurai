/**
 * GET /api/wallet/balance
 */

import { NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

export async function GET() {
  try {
    const mnemonic = process.env.WALLET_MNEMONIC;

    if (!mnemonic) {
      // Return a clear error the UI can show, not a silent 500
      return NextResponse.json(
        {
          success: false,
          error: 'WALLET_MNEMONIC not configured. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.',
        },
        { status: 500 }
      );
    }

    const provider   = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
    const usdtAddr   = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
    const usdtDec    = parseInt(process.env.USDT_DECIMALS || '6', 10);

    const wdkInstance = new WDK(mnemonic)
      .registerWallet('ethereum', WalletManagerEvm, { provider });

    const account = await wdkInstance.getAccount('ethereum', 0);
    const address = await account.getAddress();

    // ETH balance
    let ethFormatted = '0.0000';
    try {
      const wei: bigint = await account.getBalance();
      ethFormatted = (Number(wei) / 1e18).toFixed(4);
    } catch (err) {
      console.error('[balance] ETH error:', err instanceof Error ? err.message : err);
    }

    // USDT balance
    let usdtFormatted = '0.000000';
    try {
      const units: bigint = await account.getTokenBalance(usdtAddr);
      usdtFormatted = (Number(units) / Math.pow(10, usdtDec)).toFixed(usdtDec);
    } catch (err) {
      console.error('[balance] USDT error:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      success: true,
      address,
      balance: { balances: { ETH: ethFormatted, USDT: usdtFormatted } },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[balance] Fatal:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}