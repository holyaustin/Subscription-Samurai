/**
 * POST /api/agent/start  — saves user subscriptions and marks agent active
 * DELETE /api/agent/start — marks agent inactive for this user
 */

import { NextRequest, NextResponse } from 'next/server';
import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import { userStates } from '@/app/lib/agentStore';

async function deriveAddress(mnemonic: string): Promise<string> {
  const provider = process.env.RPC_URL || 'https://ethereum-sepolia-public.nodies.app';
  const wdk = new WDK(mnemonic).registerWallet('ethereum', WalletManagerEvm, { provider });
  const account = await wdk.getAccount('ethereum', 0);
  return account.getAddress();
}

export async function POST(request: NextRequest) {
  try {
    const { mnemonic, subscriptions } = await request.json();

    if (!mnemonic) {
      return NextResponse.json({ success: false, error: 'mnemonic required' }, { status: 400 });
    }
    if (!subscriptions?.length) {
      return NextResponse.json({ success: false, error: 'subscriptions required' }, { status: 400 });
    }

    const address = await deriveAddress(mnemonic);

    userStates.set(address, {
      active: true,
      mnemonic,
      address,
      subscriptions,
      startedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Agent started for ${address} with ${subscriptions.length} subscription(s)`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mnemonic } = body as { mnemonic?: string };

    if (mnemonic) {
      const address = await deriveAddress(mnemonic);
      const state = userStates.get(address);
      if (state) {
        userStates.set(address, { ...state, active: false });
      }
    }

    return NextResponse.json({ success: true, message: 'Agent stopped' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}