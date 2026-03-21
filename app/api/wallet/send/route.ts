/**
 * POST /api/wallet/send
 *
 * Body: { toAddress: string, amount: string, action: 'estimate' | 'send', token?: 'ETH' | 'USDT' }
 *
 * WDK API used (per docs):
 *
 *   Fee estimate (native ETH):
 *     account.quoteSendTransaction({ to, value: bigint }) → { fee: bigint }
 *
 *   Fee estimate (ERC-20 token):
 *     account.quoteTransfer({ token, recipient, amount: bigint }) → { fee: bigint }
 *
 *   Send native ETH:
 *     account.sendTransaction({ to, value: bigint }) → { hash: string, fee: bigint }
 *
 *   Send ERC-20 (USDT):
 *     account.transfer({ token, recipient, amount: bigint }) → { hash: string, fee: bigint }
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeWallet, estimateFee, sendPayment, sendTokenPayment } from '@/app/lib/wdk/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { toAddress, amount, action, token = 'ETH' } = body;

    // Basic validation
    if (!toAddress || !amount || !action) {
      return NextResponse.json(
        { success: false, error: 'toAddress, amount, and action are required' },
        { status: 400 }
      );
    }

    if (!['estimate', 'send'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be "estimate" or "send"' },
        { status: 400 }
      );
    }

    // Initialise wallet once — account is used for all subsequent calls
    const { account } = await initializeWallet();

    // ── Fee estimation ──────────────────────────────────────────────────────
    if (action === 'estimate') {
      if (token === 'USDT') {
        // Docs: account.quoteTransfer({ token, recipient, amount: bigint }) → { fee: bigint }
        const usdtAddress =
          process.env.USDT_CONTRACT_ADDRESS ||
          '0xdAC17F958D2ee523a2206206994597C13D831ec7';
        const amountUnits = BigInt(Math.round(parseFloat(amount) * 1e6));

        const quote = await account.quoteTransfer({
          token: usdtAddress,
          recipient: toAddress,
          amount: amountUnits,
        });

        return NextResponse.json({
          success: true,
          estimate: {
            estimatedFeeWei: quote.fee.toString(),
            estimatedFeeEth: (Number(quote.fee) / 1e18).toFixed(8),
          },
        });
      }

      // Default: native ETH estimate
      // Docs: account.quoteSendTransaction({ to, value: bigint }) → { fee: bigint }
      const estimate = await estimateFee(account, toAddress, amount);
      return NextResponse.json({ success: true, estimate });
    }

    // ── Send ────────────────────────────────────────────────────────────────
    if (action === 'send') {
      if (token === 'USDT') {
        const result = await sendTokenPayment(account, toAddress, amount);
        return NextResponse.json({ success: true, transaction: result });
      }

      // Default: send native ETH
      // Docs: account.sendTransaction({ to, value: bigint }) → { hash, fee }
      const result = await sendPayment(account, toAddress, amount);
      return NextResponse.json({ success: true, transaction: result });
    }

    // Should never reach here because of validation above
    return NextResponse.json(
      { success: false, error: 'Unhandled action' },
      { status: 400 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error('[/api/wallet/send] Error:', errorMessage);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
