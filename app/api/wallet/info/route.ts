/**
 * GET /api/wallet/info
 *
 * Returns address + full balance (ETH + USDT) for the loaded wallet.
 * Optional ?address= query param is accepted but ignored for balance
 * (WDK derives balances from the controlled account, not arbitrary addresses).
 *
 * WDK flow (per docs):
 *   account.getBalance()             → bigint (wei)
 *   account.getTokenBalance(addr)    → bigint (token base units)
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeWallet, getWalletBalance } from '@/app/lib/wdk/client';

export async function GET(request: NextRequest) {
  try {
    // initializeWallet() handles mnemonic loading/generation internally
    const { account, address } = await initializeWallet();
    const balance = await getWalletBalance(account);

    return NextResponse.json({
      success: true,
      address,
      balance,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[/api/wallet/info] Error:', errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
