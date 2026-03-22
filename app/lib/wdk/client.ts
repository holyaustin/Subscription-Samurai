/**
 * app/lib/wdk/client.ts
 *
 * Vercel-compatible: reads ONLY from process.env — no filesystem writes.
 *
 * On Vercel the filesystem is read-only. Writing to .env.local throws a 500.
 * The mnemonic MUST be set as an environment variable in the Vercel dashboard.
 *
 * Locally, if WALLET_MNEMONIC is missing we fall back to reading .env.local
 * directly (needed when the mnemonic was just generated and the server hasn't
 * restarted yet).
 */

import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

// Only import fs in non-Vercel environments
const isVercel = !!process.env.VERCEL;

export interface WalletInitResult {
  wdk: InstanceType<typeof WDK>;
  account: any;
  address: string;
  seedPhrase: string;
}

export interface BalanceResult {
  balances: {
    ETH: string;
    USDT: string;
  };
}

// ── Env helpers ───────────────────────────────────────────────────────────────

function getRpcUrl(): string {
  return process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
}

function getUsdtAddress(): string {
  return process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
}

function getUsdtDecimals(): number {
  return parseInt(process.env.USDT_DECIMALS || '6', 10);
}

// ── Mnemonic ──────────────────────────────────────────────────────────────────

async function getMnemonic(): Promise<string | null> {
  // Always check process.env first — this is the ONLY source on Vercel
  if (process.env.WALLET_MNEMONIC) {
    return process.env.WALLET_MNEMONIC;
  }

  // Local dev fallback: read .env.local directly
  // (needed when mnemonic was just written and server hasn't restarted)
  if (!isVercel) {
    try {
      const { promises: fs } = await import('fs');
      const { join } = await import('path');
      const envPath = join(process.cwd(), '.env.local');
      const content = await fs.readFile(envPath, 'utf8');
      const match = content.match(/^WALLET_MNEMONIC=(.+)$/m);
      if (match) {
        process.env.WALLET_MNEMONIC = match[1].trim();
        return process.env.WALLET_MNEMONIC;
      }
    } catch { /* file doesn't exist */ }
  }

  return null;
}

async function getOrCreateMnemonic(): Promise<string> {
  const existing = await getMnemonic();
  if (existing) return existing;

  // On Vercel: cannot write files — mnemonic must be set in dashboard
  if (isVercel) {
    throw new Error(
      'WALLET_MNEMONIC is not set. Add it to your Vercel environment variables at ' +
      'vercel.com → Project → Settings → Environment Variables'
    );
  }

  // Local dev only: generate and save to .env.local
  const { promises: fs } = await import('fs');
  const { join } = await import('path');

  const newMnemonic = WDK.getRandomSeedPhrase();
  const envPath = join(process.cwd(), '.env.local');
  let existing_content = '';
  try { existing_content = await fs.readFile(envPath, 'utf8'); } catch { /* ok */ }
  const sep = existing_content.length > 0 && !existing_content.endsWith('\n') ? '\n' : '';
  await fs.writeFile(envPath, `${existing_content}${sep}WALLET_MNEMONIC=${newMnemonic}\n`);
  process.env.WALLET_MNEMONIC = newMnemonic;
  console.log('[WDK] New mnemonic saved to .env.local — restart npm run dev');
  return newMnemonic;
}

// ── Wallet init ───────────────────────────────────────────────────────────────

export async function initializeWallet(mnemonic?: string): Promise<WalletInitResult> {
  const seedPhrase = mnemonic ?? (await getOrCreateMnemonic());
  const provider = getRpcUrl();

  const wdkInstance = new WDK(seedPhrase)
    .registerWallet('ethereum', WalletManagerEvm, { provider });

  const account = await wdkInstance.getAccount('ethereum', 0);
  const address = await account.getAddress();

  console.log(`[WDK] Wallet: ${address}`);
  return { wdk: wdkInstance, account, address, seedPhrase };
}

// ── Balance ───────────────────────────────────────────────────────────────────

export async function getWalletBalance(account: any): Promise<BalanceResult> {
  const usdtAddr = getUsdtAddress();
  const usdtDec  = getUsdtDecimals();

  let ethFormatted = '0.0000';
  try {
    const wei: bigint = await account.getBalance();
    ethFormatted = (Number(wei) / 1e18).toFixed(4);
    console.log(`[WDK] ETH: ${ethFormatted}`);
  } catch (err) {
    console.error('[WDK] ETH balance error:', err instanceof Error ? err.message : err);
  }

  let usdtFormatted = '0.000000';
  try {
    const units: bigint = await account.getTokenBalance(usdtAddr);
    usdtFormatted = (Number(units) / Math.pow(10, usdtDec)).toFixed(usdtDec);
    console.log(`[WDK] USDT: ${usdtFormatted}`);
  } catch (err) {
    console.error('[WDK] USDT balance error:', err instanceof Error ? err.message : err);
  }

  return { balances: { ETH: ethFormatted, USDT: usdtFormatted } };
}

// ── Fee estimation ────────────────────────────────────────────────────────────

export async function estimateFee(account: any, toAddress: string, amountEth: string) {
  const valueWei = BigInt(Math.round(parseFloat(amountEth) * 1e18));
  const quote = await account.quoteSendTransaction({ to: toAddress, value: valueWei });
  return {
    estimatedFeeWei: quote.fee.toString(),
    estimatedFeeEth: (Number(quote.fee) / 1e18).toFixed(8),
  };
}

// ── Send ETH ──────────────────────────────────────────────────────────────────

export async function sendPayment(account: any, toAddress: string, amountEth: string) {
  const valueWei = BigInt(Math.round(parseFloat(amountEth) * 1e18));
  const result = await account.sendTransaction({ to: toAddress, value: valueWei });
  return { txId: result.hash, feeWei: result.fee.toString(), status: 'completed', timestamp: new Date().toISOString() };
}

// ── Send USDT ─────────────────────────────────────────────────────────────────

export async function sendTokenPayment(account: any, toAddress: string, amountUsdt: string) {
  const usdtAddr    = getUsdtAddress();
  const usdtDec     = getUsdtDecimals();
  const amountUnits = BigInt(Math.round(parseFloat(amountUsdt) * Math.pow(10, usdtDec)));
  const result = await account.transfer({ token: usdtAddr, recipient: toAddress, amount: amountUnits });
  return { txId: result.hash, feeWei: result.fee.toString(), status: 'completed', timestamp: new Date().toISOString() };
}