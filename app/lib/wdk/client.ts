/**
 * app/lib/wdk/client.ts
 *
 * Uses the IDENTICAL pattern as the working /api/wallet/debug route.
 *
 * Debug works because it does:
 *   1. const mnemonic = process.env.WALLET_MNEMONIC          ← direct, no async
 *   2. new WDK(mnemonic).registerWallet('ethereum', ...)     ← exact docs pattern
 *   3. await wdkInstance.getAccount('ethereum', 0)
 *   4. await account.getBalance()                            → bigint (wei)
 *   5. await account.getTokenBalance(contractAddr)           → bigint (units)
 */

import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { promises as fs } from 'fs';
import path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Env helpers — read process.env directly, same as debug route ─────────────

function getRpcUrl(): string {
  return process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
}

function getUsdtAddress(): string {
  // Confirmed correct from Etherscan:
  // https://sepolia.etherscan.io/address/0xf49fbbaae01254d208beb1682643679e35f67fb6
  return process.env.USDT_CONTRACT_ADDRESS || '0xd077a400968890eacc75cdc901f0356c943e4fdb';
}

function getUsdtDecimals(): number {
  return parseInt(process.env.USDT_DECIMALS || '6', 10);
}

// ─── Mnemonic — read process.env directly first, file fallback only if needed ─

async function getMnemonic(): Promise<string | null> {
  // Step 1: process.env — Next.js loads .env.local here at startup
  if (process.env.WALLET_MNEMONIC) {
    return process.env.WALLET_MNEMONIC;
  }

  // Step 2: read .env.local file directly as fallback
  // (needed if mnemonic was written after the server started)
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    const content = await fs.readFile(envPath, 'utf8');
    const match = content.match(/^WALLET_MNEMONIC=(.+)$/m);
    if (match) {
      const mnemonic = match[1].trim();
      // Cache it so subsequent requests use process.env directly
      process.env.WALLET_MNEMONIC = mnemonic;
      return mnemonic;
    }
  } catch { /* file doesn't exist yet */ }

  return null; // No mnemonic — wallet hasn't been created yet
}

async function getOrCreateMnemonic(): Promise<string> {
  const existing = await getMnemonic();
  if (existing) return existing;

  // Generate new mnemonic and save to .env.local
  const newMnemonic = WDK.getRandomSeedPhrase();
  const envPath = path.join(process.cwd(), '.env.local');
  let existing_content = '';
  try { existing_content = await fs.readFile(envPath, 'utf8'); } catch { /* ok */ }
  const sep = existing_content.length > 0 && !existing_content.endsWith('\n') ? '\n' : '';
  await fs.writeFile(envPath, `${existing_content}${sep}WALLET_MNEMONIC=${newMnemonic}\n`);
  process.env.WALLET_MNEMONIC = newMnemonic;
  console.log('[WDK] New mnemonic saved to .env.local — restart npm run dev');
  return newMnemonic;
}

// ─── Wallet init — exact WDK docs pattern ─────────────────────────────────────

export async function initializeWallet(mnemonic?: string): Promise<WalletInitResult> {
  const seedPhrase = mnemonic ?? (await getOrCreateMnemonic());
  const provider = getRpcUrl();

  // Exact pattern from WDK quickstart docs:
  // https://docs.wdk.tether.io/start-building/nodejs-bare-quickstart
  const wdkInstance = new WDK(seedPhrase)
    .registerWallet('ethereum', WalletManagerEvm, { provider });

  const account = await wdkInstance.getAccount('ethereum', 0);
  const address = await account.getAddress();

  console.log(`[WDK] Wallet ready — ${address}`);
  return { wdk: wdkInstance, account, address, seedPhrase };
}

// ─── Balance — identical to the working debug route logic ─────────────────────

export async function getWalletBalance(account: any): Promise<BalanceResult> {
  const usdtAddr = getUsdtAddress();
  const usdtDec  = getUsdtDecimals();

  // ── ETH — same as debug: await account.getBalance() → bigint (wei) ────────
  let ethFormatted = '0.0000';
  try {
    const wei: bigint = await account.getBalance();
    ethFormatted = (Number(wei) / 1e18).toFixed(4);
    console.log(`[WDK] ETH: ${wei.toString()} wei → ${ethFormatted}`);
  } catch (err) {
    console.error('[WDK] ETH balance error:', err instanceof Error ? err.message : err);
  }

  // ── USDT — same as debug: await account.getTokenBalance(addr) → bigint ────
  let usdtFormatted = '0.000000';
  try {
    const units: bigint = await account.getTokenBalance(usdtAddr);
    usdtFormatted = (Number(units) / Math.pow(10, usdtDec)).toFixed(usdtDec);
    console.log(`[WDK] USDT: ${units.toString()} units → ${usdtFormatted}`);
  } catch (err) {
    console.error('[WDK] USDT balance error:', err instanceof Error ? err.message : err);
    console.error('[WDK] Contract:', usdtAddr);
  }

  return { balances: { ETH: ethFormatted, USDT: usdtFormatted } };
}

// ─── Fee estimation ───────────────────────────────────────────────────────────

export async function estimateFee(account: any, toAddress: string, amountEth: string) {
  const valueWei = BigInt(Math.round(parseFloat(amountEth) * 1e18));
  const quote = await account.quoteSendTransaction({ to: toAddress, value: valueWei });
  return {
    estimatedFeeWei: quote.fee.toString(),
    estimatedFeeEth: (Number(quote.fee) / 1e18).toFixed(8),
  };
}

// ─── Send native ETH ──────────────────────────────────────────────────────────

export async function sendPayment(account: any, toAddress: string, amountEth: string) {
  const valueWei = BigInt(Math.round(parseFloat(amountEth) * 1e18));
  const result = await account.sendTransaction({ to: toAddress, value: valueWei });
  return {
    txId: result.hash,
    feeWei: result.fee.toString(),
    status: 'completed',
    timestamp: new Date().toISOString(),
  };
}

// ─── Send ERC-20 (USDT) ───────────────────────────────────────────────────────

export async function sendTokenPayment(account: any, toAddress: string, amountUsdt: string) {
  const usdtAddr    = getUsdtAddress();
  const usdtDec     = getUsdtDecimals();
  const amountUnits = BigInt(Math.round(parseFloat(amountUsdt) * Math.pow(10, usdtDec)));

  const result = await account.transfer({
    token: usdtAddr,
    recipient: toAddress,
    amount: amountUnits,
  });
  return {
    txId: result.hash,
    feeWei: result.fee.toString(),
    status: 'completed',
    timestamp: new Date().toISOString(),
  };
}