/**
 * GET /api/wallet/balance
 *
 * Uses the identical WDK pattern as the working /api/wallet/debug route.
 *
 * Response:
 * {
 *   success: true,
 *   address: "0xf49FbBAAe01254D208bEB1682643679E35F67fb6",
 *   balance: {
 *     balances: {
 *       ETH:  "0.0010",
 *       USDT: "15.000000"
 *     }
 *   }
 * }
 */

import { NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { promises as fs } from 'fs';
import path from 'path';

async function getMnemonic(): Promise<string | null> {
  // process.env first — Next.js loads .env.local here at startup
  if (process.env.WALLET_MNEMONIC) return process.env.WALLET_MNEMONIC;

  // File fallback for mnemonics written after server started
  try {
    const content = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8');
    const match = content.match(/^WALLET_MNEMONIC=(.+)$/m);
    if (match) {
      process.env.WALLET_MNEMONIC = match[1].trim();
      return process.env.WALLET_MNEMONIC;
    }
  } catch { /* no file yet */ }

  return null;
}

export async function GET() {
  try {
    const mnemonic = await getMnemonic();

    // No mnemonic = wallet hasn't been created yet → tell UI to show Create Wallet
    if (!mnemonic) {
      return NextResponse.json(
        { success: false, error: 'No wallet found. Click Create Wallet to get started.' },
        { status: 404 }
      );
    }

    const provider   = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
    const usdtAddr   = process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
    const usdtDec    = parseInt(process.env.USDT_DECIMALS || '6', 10);

    // ── Exact WDK docs pattern ─────────────────────────────────────────────
    const wdkInstance = new WDK(mnemonic)
      .registerWallet('ethereum', WalletManagerEvm, { provider });

    const account = await wdkInstance.getAccount('ethereum', 0);
    const address = await account.getAddress();

    // ── ETH balance ────────────────────────────────────────────────────────
    let ethFormatted = '0.0000';
    try {
      const wei: bigint = await account.getBalance();
      ethFormatted = (Number(wei) / 1e18).toFixed(4);
      console.log(`[balance] ETH: ${wei} wei → ${ethFormatted}`);
    } catch (err) {
      console.error('[balance] ETH error:', err instanceof Error ? err.message : err);
    }

    // ── USDT balance ───────────────────────────────────────────────────────
    let usdtFormatted = '0.000000';
    try {
      const units: bigint = await account.getTokenBalance(usdtAddr);
      usdtFormatted = (Number(units) / Math.pow(10, usdtDec)).toFixed(usdtDec);
      console.log(`[balance] USDT: ${units} units → ${usdtFormatted}`);
    } catch (err) {
      console.error('[balance] USDT error:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json({
      success: true,
      address,
      balance: {
        balances: {
          ETH:  ethFormatted,
          USDT: usdtFormatted,
        },
      },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[balance] Fatal error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}