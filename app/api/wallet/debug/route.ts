/**
 * GET /api/wallet/debug
 * Diagnostic endpoint — remove before production.
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';

export async function GET() {
  const report: Record<string, unknown> = {};

  // ── 1. Check what process.env sees ────────────────────────────────────────
  report.process_env = {
    RPC_URL:                  process.env.RPC_URL                  ?? '❌ NOT SET',
    USDT_CONTRACT_ADDRESS:    process.env.USDT_CONTRACT_ADDRESS    ?? '❌ NOT SET',
    USDT_DECIMALS:            process.env.USDT_DECIMALS            ?? '❌ NOT SET',
    WALLET_MNEMONIC:          process.env.WALLET_MNEMONIC
      ? `✅ SET (starts with: ${process.env.WALLET_MNEMONIC.split(' ')[0]}…)`
      : '❌ NOT SET',
    NEXT_PUBLIC_EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL ?? '❌ NOT SET',
  };

  // ── 2. Read .env.local directly from disk ─────────────────────────────────
  // This reveals whether the file exists and what's actually in it,
  // regardless of whether Next.js loaded it into process.env
  const envPath = path.join(process.cwd(), '.env.local');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    // Mask mnemonic value for security, show everything else
    const masked = raw.replace(
      /^(WALLET_MNEMONIC=)(.+)$/m,
      (_, key, val) => `${key}${val.split(' ')[0]} [... masked ...]`
    );
    report.env_local_file = {
      path: envPath,
      exists: true,
      contents: masked,
    };
  } catch {
    report.env_local_file = {
      path: envPath,
      exists: false,
      error:
        '❌ .env.local file NOT FOUND at this path. ' +
        'Create it in the project root (same folder as package.json).',
    };
  }

  // ── 3. Test RPC connectivity with multiple fallbacks ──────────────────────
  const rpcCandidates = [
    process.env.RPC_URL,                              // Whatever is in env
    'https://sepolia.drpc.org',                       // dRPC (reliable)
    'https://ethereum-sepolia-rpc.publicnode.com',    // PublicNode
    'https://rpc2.sepolia.org',                       // Backup
  ].filter(Boolean) as string[];

  report.rpc_connectivity = {};
  for (const rpc of [...new Set(rpcCandidates)]) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: AbortSignal.timeout(5000),
      });
      const json = await res.json();
      (report.rpc_connectivity as Record<string, unknown>)[rpc] = json.result
        ? `✅ OK — block ${parseInt(json.result, 16)}`
        : `⚠️ responded but no result: ${JSON.stringify(json)}`;
    } catch (e) {
      (report.rpc_connectivity as Record<string, unknown>)[rpc] =
        `❌ FAILED — ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // ── 4. Find first working RPC ─────────────────────────────────────────────
  const connectivity = report.rpc_connectivity as Record<string, string>;
  const workingRpc = Object.entries(connectivity).find(([, v]) => v.startsWith('✅'))?.[0];
  report.working_rpc = workingRpc ?? '❌ None of the tested RPCs are reachable';

  // ── 5. Try wallet + balance with working RPC ──────────────────────────────
  const mnemonic = process.env.WALLET_MNEMONIC;
  const usdtAddr = process.env.USDT_CONTRACT_ADDRESS || '0x77a7a65290Ac9A95e174B34D29AbdC4d5250Eac3';
  const usdtDec  = parseInt(process.env.USDT_DECIMALS || '6', 10);

  if (!mnemonic) {
    report.wallet_test = 'Skipped — WALLET_MNEMONIC not in process.env';
  } else if (!workingRpc) {
    report.wallet_test = 'Skipped — no working RPC found';
  } else {
    try {
      const walletManager = new WalletManagerEvm(mnemonic, { provider: workingRpc });
      const account = await walletManager.getAccount(0);
      const address = await account.getAddress();
      report.wallet_test = { address, rpc_used: workingRpc };

      try {
        const ethWei: bigint = await account.getBalance();
        (report.wallet_test as Record<string, unknown>).eth = {
          raw_wei: ethWei.toString(),
          formatted: (Number(ethWei) / 1e18).toFixed(6) + ' ETH',
        };
      } catch (e) {
        (report.wallet_test as Record<string, unknown>).eth_error =
          e instanceof Error ? e.message : String(e);
      }

      try {
        const units: bigint = await account.getTokenBalance(usdtAddr);
        (report.wallet_test as Record<string, unknown>).usdt = {
          contract: usdtAddr,
          decimals: usdtDec,
          raw_units: units.toString(),
          formatted: (Number(units) / Math.pow(10, usdtDec)).toFixed(usdtDec) + ' USDT',
        };
      } catch (e) {
        (report.wallet_test as Record<string, unknown>).usdt_error =
          e instanceof Error ? e.message : String(e);
      }

      walletManager.dispose();
    } catch (e) {
      report.wallet_test = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // ── 6. Recommendation ─────────────────────────────────────────────────────
  const recommendations: string[] = [];

  if (!(process.env.RPC_URL)) {
    recommendations.push(
      '🔧 RPC_URL is missing from process.env. ' +
      'Check that .env.local exists in the project root and contains RPC_URL=... ' +
      'Then RESTART npm run dev (Next.js only reads .env.local at startup).'
    );
  }
  if (!workingRpc) {
    recommendations.push(
      '🔧 All tested RPCs failed. Add one of these to .env.local:\n' +
      '   RPC_URL=https://sepolia.drpc.org\n' +
      '   RPC_URL=https://ethereum-sepolia-rpc.publicnode.com'
    );
  } else if (workingRpc !== process.env.RPC_URL) {
    recommendations.push(
      `🔧 Your current RPC_URL is not reachable, but ${workingRpc} works. ` +
      `Update RPC_URL in .env.local to: ${workingRpc}`
    );
  }
  if (!process.env.WALLET_MNEMONIC) {
    recommendations.push('🔧 WALLET_MNEMONIC not in process.env — restart npm run dev after creating a wallet.');
  }

  report.recommendations = recommendations.length ? recommendations : ['✅ Everything looks good!'];

  return NextResponse.json(report, { status: 200 });
}