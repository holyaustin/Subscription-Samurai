/**
 * POST /api/wallet/balance
 *
 * Multi-user: accepts the user's mnemonic in the request body.
 * Each user sends their own mnemonic (stored in their browser localStorage).
 * The server uses it only for this request — never persists it.
 *
 * Body: { mnemonic: string }
 *
 * Also supports GET for the server's own wallet (WALLET_MNEMONIC env var)
 * for backward compatibility with the agent cron route.
 */

import { NextRequest, NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

const USDT_ADDRESS  = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
const USDT_DECIMALS = parseInt(process.env.USDT_DECIMALS || '6', 10);

async function getBalances(mnemonic: string) {
  const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';

  const wdkInstance = new WDK(mnemonic)
    .registerWallet('ethereum', WalletManagerEvm, { provider });

  const account = await wdkInstance.getAccount('ethereum', 0);
  const address  = await account.getAddress();

  let ethFormatted = '0.0000';
  try {
    const wei: bigint = await account.getBalance();
    ethFormatted = (Number(wei) / 1e18).toFixed(4);
  } catch (e) {
    console.error('[balance] ETH error:', e instanceof Error ? e.message : e);
  }

  let usdtFormatted = '0.000000';
  try {
    const units: bigint = await account.getTokenBalance(USDT_ADDRESS);
    usdtFormatted = (Number(units) / Math.pow(10, USDT_DECIMALS)).toFixed(USDT_DECIMALS);
  } catch (e) {
    console.error('[balance] USDT error:', e instanceof Error ? e.message : e);
  }

  return { address, balance: { balances: { ETH: ethFormatted, USDT: usdtFormatted } } };
}

// POST — user sends their mnemonic from localStorage
export async function POST(request: NextRequest) {
  try {
    const { mnemonic } = await request.json();

    if (!mnemonic || typeof mnemonic !== 'string') {
      return NextResponse.json(
        { success: false, error: 'mnemonic is required' },
        { status: 400 }
      );
    }

    const result = await getBalances(mnemonic);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[balance] POST error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// GET — uses server's WALLET_MNEMONIC (for agent cron backward compat)
export async function GET() {
  try {
    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) {
      return NextResponse.json(
        { success: false, error: 'No wallet configured on server' },
        { status: 404 }
      );
    }
    const result = await getBalances(mnemonic);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}